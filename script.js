'use strict';


const CATEGORY_EMOJIS = {
    Food: '🍕',
    Travel: '✈️',
    Shopping: '🛍️',
    Bills: '📄',
    Entertainment: '🎬',
    Education: '📚',
    Health: '💊',
    Salary: '💰',
    Freelance: '💻',
    Others: '📦'
};


const CATEGORY_CLASSES = {
    Food: 'cat-food',
    Travel: 'cat-travel',
    Shopping: 'cat-shopping',
    Bills: 'cat-bills',
    Entertainment: 'cat-entertainment',
    Education: 'cat-education',
    Health: 'cat-health',
    Salary: 'cat-salary',
    Freelance: 'cat-freelance',
    Others: 'cat-others'
};

const CHART_COLORS = {
    Food: '#f97316',
    Travel: '#0ea5e9',
    Shopping: '#a855f7',
    Bills: '#ef4444',
    Entertainment: '#ec4899',
    Education: '#22c55e',
    Health: '#14b8a6',
    Salary: '#10b981',
    Freelance: '#6366f1',
    Others: '#6b7280'
};


let selectedType = 'expense';


let deleteTargetId = null;

// Chart.js chart instances (so we can update/destroy them)
let pieChart = null;
let barChart = null;


// =====================================================
// SECTION 2: HELPER / UTILITY FUNCTIONS
// =====================================================

/**
 * Generate a unique ID for each transaction
 * Uses current timestamp + random string
 */
const generateId = () => {
    return Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9);
};

/**
 * Format a number as Indian Rupee currency
 * Example: 1500 → "₹1,500.00"
 */
const formatCurrency = (amount) => {
    return '₹' + Math.abs(amount).toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
};

/**
 * Format a date string into readable format
 * Example: "2026-06-16T10:30" → "16 Jun 2026, 10:30 am"
 */
const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};


// =====================================================
// SECTION 3: LOCAL STORAGE FUNCTIONS
// =====================================================
// Local Storage saves data in the browser even after closing it

/**
 * Get all transactions from Local Storage
 * Returns an empty array if no data exists
 */
const getTransactions = () => {
    const data = localStorage.getItem('spendwise_transactions');
    if (data) {
        return JSON.parse(data);  // Convert JSON string back to array
    }
    return [];
};

/**
 * Save transactions array to Local Storage
 */
const saveTransactions = (transactions) => {
    localStorage.setItem('spendwise_transactions', JSON.stringify(transactions));
};

/**
 * Add a new transaction
 */
const addTransaction = (transaction) => {
    const transactions = getTransactions();
    transactions.unshift(transaction);  // Add to beginning of array
    saveTransactions(transactions);
};

/**
 * Update an existing transaction by its ID
 */
const updateTransaction = (id, updatedData) => {
    const transactions = getTransactions();
    // Find the transaction with matching ID
    const index = transactions.findIndex(t => t.id === id);
    if (index !== -1) {
        // Merge old data with new data using spread operator
        transactions[index] = { ...transactions[index], ...updatedData };
        saveTransactions(transactions);
    }
};

/**
 * Delete a transaction by its ID
 */
const deleteTransaction = (id) => {
    const transactions = getTransactions();
    // Keep only transactions that DON'T match the ID
    const filtered = transactions.filter(t => t.id !== id);
    saveTransactions(filtered);
};

/**
 * Get saved theme from Local Storage
 */
const getSavedTheme = () => {
    return localStorage.getItem('spendwise_theme') || 'dark';
};

/**
 * Save theme preference to Local Storage
 */
const saveTheme = (theme) => {
    localStorage.setItem('spendwise_theme', theme);
};


// =====================================================
// SECTION 4: TOAST NOTIFICATION FUNCTION
// =====================================================
// Shows small popup messages for user feedback

/**
 * Show a toast notification
 * @param {string} type - 'success', 'error', or 'info'
 * @param {string} message - Message to display
 */
const showToast = (type, message) => {
    const container = document.getElementById('toast-container');

    // Choose emoji based on type
    let icon = '✅';
    if (type === 'error') icon = '❌';
    if (type === 'info') icon = 'ℹ️';

    // Create toast element using template literal
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${icon}</span>
        <span class="toast-message">${message}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">✕</button>
    `;

    // Add toast to container
    container.appendChild(toast);

    // Auto-remove after 3 seconds
    setTimeout(() => {
        if (toast.parentElement) {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(50px)';
            toast.style.transition = '0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }
    }, 3000);
};


// =====================================================
// SECTION 5: THEME (DARK / LIGHT MODE)
// =====================================================

/**
 * Load saved theme on page load
 */
const loadTheme = () => {
    const theme = getSavedTheme();
    document.documentElement.setAttribute('data-theme', theme);
    // Update icon
    document.getElementById('theme-icon').textContent = theme === 'dark' ? '☀️' : '🌙';
};

/**
 * Toggle between dark and light theme
 */
const toggleTheme = () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    document.documentElement.setAttribute('data-theme', newTheme);
    saveTheme(newTheme);
    document.getElementById('theme-icon').textContent = newTheme === 'dark' ? '☀️' : '🌙';

    // Re-render charts with new theme colors
    renderCharts();

    showToast('info', `Switched to ${newTheme} mode`);
};


// =====================================================
// SECTION 6: UPDATE DASHBOARD STATS
// =====================================================

/**
 * Calculate and display Balance, Income, Expense, and Count
 * Uses array methods: filter() and reduce()
 */
const updateStats = () => {
    const transactions = getTransactions();

    // Calculate total income using filter + reduce
    const totalIncome = transactions
        .filter(t => t.type === 'income')       // Keep only income transactions
        .reduce((sum, t) => sum + t.amount, 0); // Add up all amounts

    // Calculate total expenses
    const totalExpense = transactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

    // Balance = Income - Expenses
    const balance = totalIncome - totalExpense;

    // Update the HTML elements
    document.getElementById('balance-amount').textContent = formatCurrency(balance);
    document.getElementById('income-amount').textContent = formatCurrency(totalIncome);
    document.getElementById('expense-amount').textContent = formatCurrency(totalExpense);
    document.getElementById('transaction-count').textContent = transactions.length;
};


// =====================================================
// SECTION 7: RENDER TRANSACTION LIST
// =====================================================

/**
 * Get filtered and sorted transactions based on user's filter choices
 * Uses: filter(), sort(), includes()
 */
const getFilteredTransactions = () => {
    let transactions = getTransactions();

    // --- Filter by Type ---
    const typeFilter = document.getElementById('filter-type').value;
    if (typeFilter !== 'all') {
        transactions = transactions.filter(t => t.type === typeFilter);
    }

    // --- Filter by Category ---
    const categoryFilter = document.getElementById('filter-category').value;
    if (categoryFilter !== 'all') {
        transactions = transactions.filter(t => t.category === categoryFilter);
    }

    // --- Search by Title ---
    const searchQuery = document.getElementById('search-input').value.toLowerCase().trim();
    if (searchQuery) {
        transactions = transactions.filter(t =>
            t.title.toLowerCase().includes(searchQuery)
        );
    }

    // --- Sort ---
    const sortBy = document.getElementById('filter-sort').value;
    if (sortBy === 'newest') {
        transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
    } else if (sortBy === 'oldest') {
        transactions.sort((a, b) => new Date(a.date) - new Date(b.date));
    } else if (sortBy === 'highest') {
        transactions.sort((a, b) => b.amount - a.amount);
    } else if (sortBy === 'lowest') {
        transactions.sort((a, b) => a.amount - b.amount);
    }

    return transactions;
};

/**
 * Render the transaction list in HTML
 * Uses: map() and template literals
 */
const renderTransactionList = () => {
    const transactions = getFilteredTransactions();
    const container = document.getElementById('transaction-list');

    // If no transactions, show empty state
    if (transactions.length === 0) {
        container.innerHTML = `
            <div class="empty-state" id="empty-state">
                <span class="empty-icon">📝</span>
                <h3>No transactions found</h3>
                <p>Try changing filters or add a new transaction</p>
            </div>
        `;
        return;
    }

    // Build HTML for each transaction using map()
    // Destructuring is used to extract properties from each transaction
    container.innerHTML = transactions.map(({ id, title, category, type, amount, date }) => `
        <div class="transaction-item" data-id="${id}">
            <div class="txn-icon ${CATEGORY_CLASSES[category] || 'cat-others'}">
                ${CATEGORY_EMOJIS[category] || '📦'}
            </div>
            <div class="txn-details">
                <div class="txn-title">${title}</div>
                <div class="txn-meta">
                    <span class="badge ${type === 'income' ? 'badge-income' : 'badge-expense'}">
                        ${type === 'income' ? 'Income' : 'Expense'}
                    </span>
                    <span>${category}</span>
                    <span>·</span>
                    <span>${formatDate(date)}</span>
                </div>
            </div>
            <div class="txn-amount ${type}">
                ${type === 'income' ? '+' : '-'}${formatCurrency(amount)}
            </div>
            <div class="txn-actions">
                <button class="edit-btn" data-id="${id}" title="Edit">✏️</button>
                <button class="delete-btn" data-id="${id}" title="Delete">🗑️</button>
            </div>
        </div>
    `).join('');  // join('') combines all array items into one string
};


// =====================================================
// SECTION 8: CHARTS (Chart.js)
// =====================================================

/**
 * Render both Pie Chart and Bar Chart
 */
const renderCharts = () => {
    renderPieChart();
    renderBarChart();
};

/**
 * Render Pie/Doughnut Chart — Category-wise Expenses
 * Groups expenses by category using reduce()
 */
const renderPieChart = () => {
    const canvas = document.getElementById('pie-chart');
    const emptyMsg = document.getElementById('pie-empty');
    const transactions = getTransactions();

    // Get only expense transactions
    const expenses = transactions.filter(t => t.type === 'expense');

    // Group expenses by category using reduce()
    // Result: { Food: 500, Travel: 200, ... }
    const categoryTotals = expenses.reduce((acc, transaction) => {
        const { category, amount } = transaction;  // Destructuring
        acc[category] = (acc[category] || 0) + amount;
        return acc;
    }, {});

    const categories = Object.keys(categoryTotals);    // ['Food', 'Travel', ...]
    const amounts = Object.values(categoryTotals);     // [500, 200, ...]

    // If no expenses, show empty message
    if (categories.length === 0) {
        canvas.style.display = 'none';
        emptyMsg.style.display = 'block';
        if (pieChart) { pieChart.destroy(); pieChart = null; }
        return;
    }

    canvas.style.display = 'block';
    emptyMsg.style.display = 'none';

    // Get colors for each category
    const colors = categories.map(cat => CHART_COLORS[cat] || '#6b7280');

    // Destroy old chart before creating new one
    if (pieChart) pieChart.destroy();

    // Create new doughnut chart
    pieChart = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: categories,
            datasets: [{
                data: amounts,
                backgroundColor: colors,
                borderWidth: 0,
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '60%',     // Makes it a doughnut (hollow center)
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: getComputedStyle(document.documentElement)
                            .getPropertyValue('--text-secondary').trim(),
                        font: { family: "'Inter', sans-serif", size: 11 },
                        padding: 14,
                        usePointStyle: true
                    }
                },
                tooltip: {
                    callbacks: {
                        label: (context) => ` ${context.label}: ${formatCurrency(context.raw)}`
                    }
                }
            }
        }
    });
};

/**
 * Render Bar Chart — Monthly Spending Trend (last 6 months)
 */
const renderBarChart = () => {
    const canvas = document.getElementById('bar-chart');
    const emptyMsg = document.getElementById('bar-empty');
    const transactions = getTransactions();

    // Get data for last 6 months
    const now = new Date();
    const labels = [];      // Month names
    const incomeData = [];   // Income for each month
    const expenseData = [];  // Expense for each month

    // Loop through last 6 months (from oldest to newest)
    for (let i = 5; i >= 0; i--) {
        const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const year = monthDate.getFullYear();
        const month = monthDate.getMonth();

        // Create label like "Jun '26"
        const label = monthDate.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
        labels.push(label);

        // Filter transactions for this specific month
        const monthTransactions = transactions.filter(t => {
            const d = new Date(t.date);
            return d.getFullYear() === year && d.getMonth() === month;
        });

        // Calculate income and expense for this month
        const monthIncome = monthTransactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + t.amount, 0);

        const monthExpense = monthTransactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + t.amount, 0);

        incomeData.push(monthIncome);
        expenseData.push(monthExpense);
    }

    // Check if there's any data at all
    const hasData = incomeData.some(v => v > 0) || expenseData.some(v => v > 0);

    if (!hasData) {
        canvas.style.display = 'none';
        emptyMsg.style.display = 'block';
        if (barChart) { barChart.destroy(); barChart = null; }
        return;
    }

    canvas.style.display = 'block';
    emptyMsg.style.display = 'none';

    // Destroy old chart
    if (barChart) barChart.destroy();

    // Create new bar chart
    barChart = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Income',
                    data: incomeData,
                    backgroundColor: 'rgba(52, 211, 153, 0.7)',
                    borderColor: '#34d399',
                    borderWidth: 1,
                    borderRadius: 6
                },
                {
                    label: 'Expenses',
                    data: expenseData,
                    backgroundColor: 'rgba(248, 113, 113, 0.7)',
                    borderColor: '#f87171',
                    borderWidth: 1,
                    borderRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: getComputedStyle(document.documentElement)
                            .getPropertyValue('--text-secondary').trim(),
                        font: { family: "'Inter', sans-serif", size: 11 },
                        usePointStyle: true
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: getComputedStyle(document.documentElement)
                            .getPropertyValue('--text-muted').trim()
                    },
                    grid: { display: false }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: getComputedStyle(document.documentElement)
                            .getPropertyValue('--text-muted').trim(),
                        callback: (value) => formatCurrency(value)
                    },
                    grid: { color: 'rgba(148, 163, 184, 0.06)' }
                }
            }
        }
    });
};


// =====================================================
// SECTION 9: EXPORT TO CSV
// =====================================================

/**
 * Export filtered transactions to CSV file
 * CSV = Comma Separated Values (opens in Excel)
 */
const exportToCSV = () => {
    const transactions = getFilteredTransactions();

    if (transactions.length === 0) {
        showToast('error', 'No transactions to export!');
        return;
    }

    // Create header row
    const headers = ['Date', 'Type', 'Category', 'Title', 'Amount'];

    // Create data rows using map()
    const rows = transactions.map(({ date, type, category, title, amount }) => {
        return [
            formatDate(date),
            type === 'income' ? 'Income' : 'Expense',
            category,
            `"${title}"`,           // Wrap in quotes in case title has commas
            type === 'income' ? `+${amount}` : `-${amount}`
        ].join(',');                 // Join with commas
    });

    // Combine headers and rows
    const csvContent = [headers.join(','), ...rows].join('\n');

    // Create downloadable file
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);

    // Create temporary link and click it to download
    const link = document.createElement('a');
    link.href = url;
    link.download = `SpendWise_Transactions_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();

    // Cleanup
    URL.revokeObjectURL(url);

    showToast('success', 'CSV exported successfully!');
};


// =====================================================
// SECTION 10: MODAL HANDLING
// =====================================================

/**
 * Open the Add/Edit Transaction modal
 * @param {string|null} editId - If editing, pass the transaction ID
 */
const openModal = (editId = null) => {
    const modal = document.getElementById('modal-overlay');
    const form = document.getElementById('transaction-form');
    const titleEl = document.getElementById('modal-title');
    const submitBtn = document.getElementById('submit-btn');

    // Reset form
    form.reset();
    clearAllErrors();
    document.getElementById('edit-id').value = '';

    if (editId) {
        // === EDIT MODE ===
        const transactions = getTransactions();
        const transaction = transactions.find(t => t.id === editId);

        if (!transaction) return;

        titleEl.textContent = 'Edit Transaction';
        submitBtn.textContent = 'Update Transaction';

        // Fill form with existing data
        document.getElementById('edit-id').value = transaction.id;
        document.getElementById('title-input').value = transaction.title;
        document.getElementById('amount-input').value = transaction.amount;
        document.getElementById('category-input').value = transaction.category;
        document.getElementById('date-input').value = transaction.date.slice(0, 16);

        // Set the type toggle
        setType(transaction.type);
    } else {
        // === ADD MODE ===
        titleEl.textContent = 'Add Transaction';
        submitBtn.textContent = 'Add Transaction';

        // Set default date to now
        const now = new Date();
        document.getElementById('date-input').value = now.toISOString().slice(0, 16);

        setType('expense');
    }

    // Show modal
    modal.classList.remove('hidden');

    // Focus on title input
    document.getElementById('title-input').focus();
};

/**
 * Close the Add/Edit Transaction modal
 */
const closeModal = () => {
    document.getElementById('modal-overlay').classList.add('hidden');
};

/**
 * Set the transaction type (income or expense)
 */
const setType = (type) => {
    selectedType = type;
    // Toggle active class on buttons
    document.getElementById('btn-expense').classList.toggle('active', type === 'expense');
    document.getElementById('btn-income').classList.toggle('active', type === 'income');
};


// =====================================================
// SECTION 11: FORM VALIDATION
// =====================================================

/**
 * Show error message on a form field
 */
const showError = (fieldId, message) => {
    const field = document.getElementById(fieldId);
    const errorEl = document.getElementById(fieldId.replace('-input', '-error'));
    field.classList.add('invalid');
    if (errorEl) errorEl.textContent = message;
};

/**
 * Clear all error messages
 */
const clearAllErrors = () => {
    // Remove 'invalid' class from all inputs
    document.querySelectorAll('.invalid').forEach(el => el.classList.remove('invalid'));
    // Clear all error messages
    document.querySelectorAll('.error-msg').forEach(el => el.textContent = '');
};

/**
 * Validate the transaction form
 * Returns true if valid, false if not
 */
const validateForm = () => {
    clearAllErrors();
    let isValid = true;

    const title = document.getElementById('title-input').value.trim();
    const amount = document.getElementById('amount-input').value;
    const category = document.getElementById('category-input').value;
    const date = document.getElementById('date-input').value;

    if (!title) {
        showError('title-input', 'Please enter a title');
        isValid = false;
    }

    if (!amount || parseFloat(amount) <= 0) {
        showError('amount-input', 'Please enter a valid amount');
        isValid = false;
    }

    if (!category) {
        showError('category-input', 'Please select a category');
        isValid = false;
    }

    if (!date) {
        showError('date-input', 'Please select a date');
        isValid = false;
    }

    return isValid;
};


// =====================================================
// SECTION 12: FORM SUBMISSION (ADD / EDIT)
// =====================================================

/**
 * Handle form submission — adds new or updates existing transaction
 */
const handleFormSubmit = (event) => {
    event.preventDefault();  // Prevent page reload

    // Validate first
    if (!validateForm()) return;

    // Get form values
    const editId = document.getElementById('edit-id').value;
    const title = document.getElementById('title-input').value.trim();
    const amount = parseFloat(document.getElementById('amount-input').value);
    const category = document.getElementById('category-input').value;
    const date = document.getElementById('date-input').value;

    // Create transaction object
    const transactionData = {
        title: title,
        amount: amount,
        type: selectedType,
        category: category,
        date: new Date(date).toISOString()
    };

    if (editId) {
        // Update existing transaction
        updateTransaction(editId, transactionData);
        showToast('success', `"${title}" updated successfully!`);
    } else {
        // Add new transaction with unique ID
        transactionData.id = generateId();
        addTransaction(transactionData);
        showToast('success', `"${title}" added — ${formatCurrency(amount)}`);
    }

    // Close modal and refresh the page data
    closeModal();
    refreshAll();
};


// =====================================================
// SECTION 13: DELETE TRANSACTION
// =====================================================

/**
 * Show the delete confirmation modal
 */
const showDeleteConfirm = (id) => {
    deleteTargetId = id;
    document.getElementById('confirm-overlay').classList.remove('hidden');
};

/**
 * Hide the delete confirmation modal
 */
const hideDeleteConfirm = () => {
    deleteTargetId = null;
    document.getElementById('confirm-overlay').classList.add('hidden');
};

/**
 * Actually delete the transaction after confirmation
 */
const confirmDelete = () => {
    if (deleteTargetId) {
        deleteTransaction(deleteTargetId);
        showToast('success', 'Transaction deleted');
        hideDeleteConfirm();
        refreshAll();
    }
};


// =====================================================
// SECTION 14: REFRESH ALL DATA
// =====================================================

/**
 * Refresh all parts of the page — stats, list, and charts
 */
const refreshAll = () => {
    updateStats();
    renderTransactionList();
    renderCharts();
};


// =====================================================
// SECTION 15: EVENT LISTENERS
// =====================================================
// All click, input, and keyboard events are set up here

/**
 * Initialize everything when the page loads
 */
document.addEventListener('DOMContentLoaded', () => {

    // --- Load saved theme ---
    loadTheme();

    // --- Render all data ---
    refreshAll();

    // --- Theme Toggle Button ---
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

    // --- Open Add Transaction Modal ---
    document.getElementById('open-modal-btn').addEventListener('click', () => openModal());

    // --- Close Modal (X button) ---
    document.getElementById('close-modal-btn').addEventListener('click', closeModal);

    // --- Close Modal on clicking overlay (outside the modal) ---
    document.getElementById('modal-overlay').addEventListener('click', (event) => {
        if (event.target === event.currentTarget) closeModal();
    });

    // --- Type Toggle Buttons (Expense / Income) ---
    document.getElementById('btn-expense').addEventListener('click', () => setType('expense'));
    document.getElementById('btn-income').addEventListener('click', () => setType('income'));

    // --- Form Submit ---
    document.getElementById('transaction-form').addEventListener('submit', handleFormSubmit);

    // --- Edit & Delete Buttons (Event Delegation) ---
    // Instead of adding listeners to each button, we listen on the parent container
    // and check which button was clicked — this is called Event Delegation
    document.getElementById('transaction-list').addEventListener('click', (event) => {
        const editBtn = event.target.closest('.edit-btn');
        const deleteBtn = event.target.closest('.delete-btn');

        if (editBtn) {
            openModal(editBtn.dataset.id);  // Open modal in edit mode
        }

        if (deleteBtn) {
            showDeleteConfirm(deleteBtn.dataset.id);  // Show delete confirmation
        }
    });

    // --- Filter Dropdowns ---
    document.getElementById('filter-type').addEventListener('change', renderTransactionList);
    document.getElementById('filter-category').addEventListener('change', renderTransactionList);
    document.getElementById('filter-sort').addEventListener('change', renderTransactionList);

    // --- Search Input (with debounce for better performance) ---
    let searchTimer;
    document.getElementById('search-input').addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(renderTransactionList, 300);  // Wait 300ms after typing
    });

    // --- Export CSV Button ---
    document.getElementById('export-csv-btn').addEventListener('click', exportToCSV);

    // --- Delete Confirmation Buttons ---
    document.getElementById('confirm-delete').addEventListener('click', confirmDelete);
    document.getElementById('confirm-cancel').addEventListener('click', hideDeleteConfirm);

    // --- Close modals with Escape key ---
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeModal();
            hideDeleteConfirm();
        }
    });
});
