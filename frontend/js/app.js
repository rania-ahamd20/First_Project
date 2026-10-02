const API_URL = 'http://localhost:3000/api/expenses';
let allExpenses = []; 
let editModalInstance = null;
let categoryChart = null;

const elements = {
    alertContainer: document.getElementById('alert-container'),
    spinner: document.getElementById('loading-spinner'),
    spinnerBackdrop: document.getElementById('spinner-backdrop'),
    tableBody: document.getElementById('expense-table-body'),
    filterCategory: document.getElementById('filter-category'),
    searchTitle: document.getElementById('search-title'),
    addForm: document.getElementById('add-form'),
    editForm: document.getElementById('edit-form'),
    summaryTotal: document.getElementById('summary-total'),
    summaryCount: document.getElementById('summary-count'),
    summaryHighest: document.getElementById('summary-highest'),
    btnExportCsv: document.getElementById('btn-export-csv')
};

const CATEGORY_COLORS = {
    'Food': '#ff9f1c',
    'Transport': '#2ec4b6',
    'Bills': '#ffbf69',
    'Entertainment': '#17a2b8',
    'Other': '#343a40'
};

document.addEventListener('DOMContentLoaded', () => {
    editModalInstance = new bootstrap.Modal(document.getElementById('editModal'));
    fetchExpenses();

    elements.addForm.addEventListener('submit', handleAddExpense);
    elements.editForm.addEventListener('submit', handleEditExpense);
    elements.filterCategory.addEventListener('change', renderTable);
    elements.searchTitle.addEventListener('input', renderTable);
    elements.btnExportCsv.addEventListener('click', exportToCSV);
});

function toggleSpinner(show) {
    elements.spinner.style.display = show ? 'block' : 'none';
    elements.spinnerBackdrop.style.display = show ? 'block' : 'none';
}

function showAlert(message, type = 'danger') {
    const alertHtml = `
        <div class="alert alert-${type} alert-dismissible fade show shadow-sm" role="alert">
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>
    `;
    elements.alertContainer.innerHTML = alertHtml;
    if (type === 'success') {
        setTimeout(() => {
            if (elements.alertContainer.innerHTML.includes(message)) {
                elements.alertContainer.innerHTML = '';
            }
        }, 3000);
    }
}

function getCategoryBadge(category) {
    const badges = {
        'Food': 'badge-food',
        'Transport': 'badge-transport',
        'Bills': 'badge-bills',
        'Entertainment': 'badge-entertainment',
        'Other': 'badge-others'
    };
    return `<span class="badge ${badges[category] || 'badge-others'}">${category}</span>`;
}

async function fetchExpenses() {
    toggleSpinner(true);
    try {
        const response = await fetch(API_URL);
        if (!response.ok) await handleApiError(response);
        
        allExpenses = await response.json();
        updateSummaries();
        updateChart();
        renderTable();
    } catch (error) {
        handleNetworkError(error);
    } finally {
        toggleSpinner(false);
    }
}

async function handleAddExpense(e) {
    e.preventDefault();
    
    const expenseData = {
        title: document.getElementById('add-title').value.trim(),
        amount: parseFloat(document.getElementById('add-amount').value),
        category: document.getElementById('add-category').value,
        date: document.getElementById('add-date').value
    };

    if (!validateExpense(expenseData)) return;

    toggleSpinner(true);
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(expenseData)
        });

        if (!response.ok) await handleApiError(response);
        
        elements.addForm.reset();
        showAlert('Expense added successfully!', 'success');
        await fetchExpenses();
    } catch (error) {
        handleNetworkError(error);
    } finally {
        toggleSpinner(false);
    }
}

async function deleteExpense(id) {
    if (!confirm('Are you sure you want to delete this expense?')) return;

    toggleSpinner(true);
    try {
        const response = await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
        if (!response.ok) await handleApiError(response);
        
        showAlert('Expense deleted successfully!', 'success');
        await fetchExpenses();
    } catch (error) {
        handleNetworkError(error);
    } finally {
        toggleSpinner(false);
    }
}

function openEditModal(id) {
    const expense = allExpenses.find(e => String(e.id || e._id) === String(id));
    if (!expense) return;

    document.getElementById('edit-id').value = expense.id || expense._id;
    document.getElementById('edit-title').value = expense.title;
    document.getElementById('edit-amount').value = expense.amount;
    document.getElementById('edit-category').value = expense.category;

    const dateStr = typeof expense.date === 'string' 
        ? expense.date.substring(0, 10) 
        : new Date(expense.date).toISOString().substring(0, 10);

    document.getElementById('edit-date').value = dateStr;
    editModalInstance.show();
}

async function handleEditExpense(e) {
    e.preventDefault();
    
    const id = document.getElementById('edit-id').value;
    const expenseData = {
        title: document.getElementById('edit-title').value.trim(),
        amount: parseFloat(document.getElementById('edit-amount').value),
        category: document.getElementById('edit-category').value,
        date: document.getElementById('edit-date').value
    };

    if (!validateExpense(expenseData)) return;

    toggleSpinner(true);
    try {
        const response = await fetch(`${API_URL}/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(expenseData)
        });

        if (!response.ok) await handleApiError(response);
        
        editModalInstance.hide();
        showAlert('Expense updated successfully!', 'success');
        await fetchExpenses();
    } catch (error) {
        handleNetworkError(error);
    } finally {
        toggleSpinner(false);
    }
}

function validateExpense(data) {
    if (!data.title || !data.category || !data.date) {
        showAlert('All fields are required.');
        return false;
    }
    if (isNaN(data.amount) || data.amount <= 0) {
        showAlert('Amount must be a number greater than zero.');
        return false;
    }
    return true;
}

function updateSummaries() {
    const total = allExpenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
    const highest = allExpenses.length > 0 
        ? Math.max(...allExpenses.map(exp => Number(exp.amount))) 
        : 0;

    elements.summaryTotal.textContent = `$${total.toFixed(2)}`;
    elements.summaryCount.textContent = allExpenses.length;
    elements.summaryHighest.textContent = `$${highest.toFixed(2)}`;
}

function renderTable() {
    const selectedCategory = elements.filterCategory.value;
    const searchTerm = elements.searchTitle.value.toLowerCase().trim();

    const filteredExpenses = allExpenses.filter(exp => {
        const matchesCategory = selectedCategory === 'All' || exp.category === selectedCategory;
        const matchesSearch = exp.title.toLowerCase().includes(searchTerm);
        return matchesCategory && matchesSearch;
    });

    if (filteredExpenses.length === 0) {
        elements.tableBody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-3">No expenses found.</td></tr>`;
        return;
    }

    elements.tableBody.innerHTML = filteredExpenses.map(exp => {
        const id = exp.id || exp._id;
        return `
            <tr>
                <td class="ps-3 fw-semibold">${exp.title}</td>
                <td class="fw-bold">$${Number(exp.amount).toFixed(2)}</td>
                <td>${getCategoryBadge(exp.category)}</td>
                <td>${new Date(exp.date).toLocaleDateString()}</td>
                <td class="text-end pe-3">
                    <button class="btn btn-sm btn-outline-primary me-1" onclick="openEditModal('${id}')">Edit</button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteExpense('${id}')">Delete</button>
                </td>
            </tr>
        `;
    }).join('');
}

function updateChart() {
    const categoryTotals = {};
    allExpenses.forEach(exp => {
        categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + Number(exp.amount);
    });

    const labels = Object.keys(categoryTotals);
    const data = Object.values(categoryTotals);
    const backgroundColors = labels.map(cat => CATEGORY_COLORS[cat] || '#343a40');

    const ctx = document.getElementById('category-chart').getContext('2d');

    if (categoryChart) {
        categoryChart.destroy();
    }

    categoryChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: backgroundColors
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
}

function exportToCSV() {
    if (allExpenses.length === 0) {
        showAlert('No expenses to export.');
        return;
    }

    const headers = ['Title', 'Amount', 'Category', 'Date'];
    const rows = allExpenses.map(exp => [
        `"${exp.title.replace(/"/g, '""')}"`,
        exp.amount,
        `"${exp.category}"`,
        `"${new Date(exp.date).toISOString().split('T')[0]}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `expense_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

async function handleApiError(response) {
    let errorMsg = `Server returned status code: ${response.status}`;
    try {
        const errorData = await response.json();
        if (errorData.message) errorMsg = errorData.message;
    } catch (e) {
    }
    throw new Error(errorMsg);
}

function handleNetworkError(error) {
    if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
        showAlert('Unable to connect to the server. Please check if your API server is running on port 3000.');
    } else {
        showAlert(error.message);
    }
}