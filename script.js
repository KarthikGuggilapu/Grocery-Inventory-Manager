import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// Supabase configuration
const supabaseUrl = 'https://xcngpjsjgsqtsvogcquk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjbmdwanNqZ3NxdHN2b2djcXVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU5MDQ5MjIsImV4cCI6MjA2MTQ4MDkyMn0.2K5klU77WGu1HB2hBii3xw3FGQ4ET_LqM9HRQaahwUQ';
const supabase = createClient(supabaseUrl, supabaseKey);

// DOM Elements
const formModal = document.getElementById('formModal');
const detailsModal = document.getElementById('detailsModal');
const confirmModal = document.getElementById('confirmModal');
const openFormBtn = document.getElementById('openFormBtn');
const closeFormBtn = document.getElementById('closeFormBtn');
const closeDetailsBtn = document.getElementById('closeDetailsBtn');
const inventoryForm = document.getElementById('inventoryForm');
const tableBody = document.getElementById('tableBody');
const loader = document.getElementById('loader');
const search = document.getElementById('search');
const submitBtn = document.getElementById('submitBtn');
const printBtn = document.getElementById('printBtn');
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toastMessage');
const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
const itemDetails = document.getElementById('itemDetails');

// State variables
let editingId = null;
let itemToDelete = null;
let items = [];

// Event Listeners
openFormBtn.addEventListener('click', () => {
  formModal.classList.remove('hidden');
  formModal.classList.add('flex');
  document.getElementById('name').focus();
});

closeFormBtn.addEventListener('click', () => {
  formModal.classList.add('hidden');
  formModal.classList.remove('flex');
  resetForm();
});

closeDetailsBtn.addEventListener('click', () => {
  detailsModal.classList.add('hidden');
  detailsModal.classList.remove('flex');
});

cancelDeleteBtn.addEventListener('click', () => {
  confirmModal.classList.add('hidden');
  confirmModal.classList.remove('flex');
  itemToDelete = null;
});

// Close modals when clicking outside
[formModal, detailsModal, confirmModal].forEach(modal => {
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
      if (modal === formModal) resetForm();
      if (modal === confirmModal) itemToDelete = null;
    }
  });
});

// Form submission
inventoryForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  submitBtn.disabled = true;
  const originalButtonText = submitBtn.textContent;
  submitBtn.innerHTML = '<span class="inline-block animate-spin-slow mr-2">⟳</span> Processing...';
  showLoader();

  try {
    const nameInput = document.getElementById('name').value.trim();
    const wholesale = parseFloat(document.getElementById('wholesale').value);
    const retail = parseFloat(document.getElementById('retail').value);

    const names = nameInput.split(',').map(n => n.trim()).filter(Boolean);

    if (editingId) {
      const teluguName = await translateToTelugu(names[0]);
      await supabase.from('inventory').update({
        name_eng: names[0],
        name_tel: teluguName,
        wholesale_price: wholesale,
        retail_price: retail
      }).eq('id', editingId);
      
      showToast('Item updated successfully');
      editingId = null;
      submitBtn.textContent = 'Add Item';
    } else {
      const items = await Promise.all(names.map(async (name) => {
        const telugu = await translateToTelugu(name);
        return { name_eng: name, name_tel: telugu, wholesale_price: wholesale, retail_price: retail };
      }));
      
      await supabase.from('inventory').insert(items);
      showToast(names.length > 1 ? 'Items added successfully' : 'Item added successfully');
    }

    resetForm();
    formModal.classList.add('hidden');
    formModal.classList.remove('flex');
    await fetchItems();
  } catch (error) {
    console.error('Error:', error);
    showToast('An error occurred. Please try again.', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalButtonText;
    hideLoader();
  }
});

// Search functionality
search.addEventListener('input', () => {
  const keyword = search.value.toLowerCase();
  filterItems(keyword);
});

// Download button
printBtn.addEventListener('click', async () => {
  showLoader();
  try {
    const { data } = await supabase.from('inventory').select('name_tel, retail_price');
    const content = data.map(item => `${item.name_tel} - ₹${item.retail_price}`).join('\n');
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'grocery_list.txt';
    a.click();
    
    URL.revokeObjectURL(url);
    showToast('List downloaded successfully');
  } catch (error) {
    console.error('Error downloading list:', error);
    showToast('Failed to download list', 'error');
  } finally {
    hideLoader();
  }
});

// Confirm delete
confirmDeleteBtn.addEventListener('click', async () => {
  if (!itemToDelete) return;
  
  showLoader();
  try {
    await supabase.from('inventory').delete().eq('id', itemToDelete);
    showToast('Item deleted successfully');
    await fetchItems();
  } catch (error) {
    console.error('Error deleting item:', error);
    showToast('Failed to delete item', 'error');
  } finally {
    hideLoader();
    confirmModal.classList.add('hidden');
    confirmModal.classList.remove('flex');
    itemToDelete = null;
  }
});

// Show item details
function showItemDetails(item) {
  itemDetails.innerHTML = `
    <div class="space-y-3">
      <div>
        <label class="text-sm text-gray-500">English Name</label>
        <p class="text-lg font-medium">${escapeHtml(item.name_eng)}</p>
      </div>
      <div>
        <label class="text-sm text-gray-500">Telugu Name</label>
        <p class="text-lg font-medium telugu-text">${escapeHtml(item.name_tel)}</p>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="text-sm text-gray-500">Wholesale Price</label>
          <p class="text-lg font-medium">₹${formatPrice(item.wholesale_price)}</p>
        </div>
        <div>
          <label class="text-sm text-gray-500">Retail Price</label>
          <p class="text-lg font-medium">₹${formatPrice(item.retail_price)}</p>
        </div>
      </div>
      <div class="flex gap-2 pt-4">
        <button onclick="editItem('${item.id}')" class="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition duration-150">
          Edit
        </button>
        <button onclick="deleteItem('${item.id}')" class="flex-1 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition duration-150">
          Delete
        </button>
      </div>
    </div>
  `;
  
  detailsModal.classList.remove('hidden');
  detailsModal.classList.add('flex');
}

// Data fetching
async function fetchItems() {
  showLoader();
  try {
    const { data, error } = await supabase.from('inventory').select('*').order('id', { ascending: false });
    
    if (error) throw error;
    
    items = data || [];
    displayItems(items);
  } catch (error) {
    console.error('Error fetching items:', error);
    showToast('Failed to load inventory items', 'error');
  } finally {
    hideLoader();
  }
}

// Display items in table
function displayItems(data) {
  if (!data || data.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-state">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
          <h3 class="text-lg font-medium">No items found</h3>
          <p>Add some grocery items to get started</p>
        </td>
      </tr>
    `;
    return;
  }

  const isMobile = window.innerWidth < 768;
  
  tableBody.innerHTML = data.map((item, index) => {
    if (isMobile) {
      return `
        <tr class="hover:bg-gray-50 transition-colors duration-150 cursor-pointer" onclick="showItemDetails(${JSON.stringify(item).replace(/"/g, '&quot;')})">
          <td class="p-4">
            <div class="flex justify-between items-center">
              <div>
                <div class="font-medium">${escapeHtml(item.name_eng)}</div>
                <div class="text-sm text-gray-500 telugu-text">${escapeHtml(item.name_tel)}</div>
              </div>
              <div class="text-lg font-medium">₹${formatPrice(item.retail_price)}</div>
            </div>
          </td>
        </tr>
      `;
    }
    
    return `
      <tr class="hover:bg-gray-50 transition-colors duration-150">
        <td class="p-3">${index + 1}</td>
        <td class="p-3">${escapeHtml(item.name_eng)}</td>
        <td class="p-3 telugu-text">${escapeHtml(item.name_tel)}</td>
        <td class="p-3 price">₹${formatPrice(item.wholesale_price)}</td>
        <td class="p-3 price">₹${formatPrice(item.retail_price)}</td>
        <td class="p-3 flex justify-center gap-2">
          <button 
            onclick="editItem('${item.id}')" 
            class="flex items-center text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50 transition-colors duration-150"
            title="Edit item"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit
          </button>
          <button 
            onclick="deleteItem('${item.id}')" 
            class="flex items-center text-red-600 hover:text-red-800 px-2 py-1 rounded hover:bg-red-50 transition-colors duration-150"
            title="Delete item"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// Filter items based on search
function filterItems(keyword) {
  if (!keyword) {
    displayItems(items);
    return;
  }
  
  const filtered = items.filter(item => 
    item.name_eng.toLowerCase().includes(keyword) || 
    item.name_tel.toLowerCase().includes(keyword)
  );
  
  displayItems(filtered);
}

// English to Telugu translation
// async function translateToTelugu(text) {
//   try {
//     const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|te`);
//     const data = await res.json();
//     return data.responseData.translatedText || text;
//   } catch (error) {
//     console.error('Translation error:', error);
//     showToast('Translation failed. Using English text instead.', 'warning');
//     return text;
//   }
// }

async function translateToTelugu(text) {
  try {
    showToast(text);
    const url = `https://aksharamukha-plugin.appspot.com/api/public?source=HK&target=Telugu&text=${encodeURIComponent(text)}`;
    const res = await fetch(url);
    const responseText = await res.text();

    console.log('Aksharamukha API response:', responseText);
    showToast(responseText);

    // The API directly returns the converted text (like "మినువులు")
    return responseText;
  } catch (error) {
    console.error('Transliteration error:', error);
    showToast('Transliteration failed. Using English text instead.', 'warning');
    return text;
  }
}




// Edit item
window.editItem = async (id) => {
  showLoader();
  try {
    const { data, error } = await supabase.from('inventory').select('*').eq('id', id).single();
    
    if (error) throw error;
    
    document.getElementById('name').value = data.name_eng;
    document.getElementById('wholesale').value = data.wholesale_price;
    document.getElementById('retail').value = data.retail_price;
    
    editingId = id;
    submitBtn.textContent = 'Update Item';
    formModal.classList.remove('hidden');
    formModal.classList.add('flex');
    detailsModal.classList.add('hidden');
    detailsModal.classList.remove('flex');
  } catch (error) {
    console.error('Error fetching item details:', error);
    showToast('Failed to load item details', 'error');
  } finally {
    hideLoader();
  }
};

// Delete item
window.deleteItem = (id) => {
  itemToDelete = id;
  confirmModal.classList.remove('hidden');
  confirmModal.classList.add('flex');
  detailsModal.classList.add('hidden');
  detailsModal.classList.remove('flex');
};

// Reset form
function resetForm() {
  inventoryForm.reset();
  editingId = null;
  submitBtn.disabled = false;
  submitBtn.textContent = 'Add Item';
}

// Helper functions
function showLoader() {
  loader.classList.remove('hidden');
  loader.classList.add('flex');
}

function hideLoader() {
  loader.classList.add('hidden');
  loader.classList.remove('flex');
}

function showToast(message, type = 'success') {
  toastMessage.textContent = message;
  toast.className = 'fixed bottom-4 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-lg shadow-lg fade-in';
  
  if (type === 'error') {
    toast.classList.add('bg-red-600', 'text-white');
  } else if (type === 'warning') {
    toast.classList.add('bg-yellow-600', 'text-white');
  } else {
    toast.classList.add('bg-green-600', 'text-white');
  }
  
  toast.classList.remove('hidden');
  
  setTimeout(() => {
    toast.classList.add('hidden');
  }, 3000);
}

function formatPrice(price) {
  return Number(price).toFixed(2);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  fetchItems();
  
  // Check for mobile layout changes
  window.addEventListener('resize', () => {
    displayItems(items);
  });
});