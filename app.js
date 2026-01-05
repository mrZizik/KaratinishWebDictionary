let db = null;
let currentPage = 1;
const perPage = 100;
let isLoading = false;
let hasMore = true;
let totalWords = 0;
let isSearching = false;
let elements = {}; // Кэш для DOM элементов

const DB_VERSION = 'v1.0';
const DB_DATE = '25.12.2025';

// Функция для кэширования DOM элементов
function cacheElements() {
    elements = {
        searchInput: document.getElementById('searchInput'),
        searchLoading: document.getElementById('searchLoading'),
        loadingSpinner: document.getElementById('loadingSpinner'),
        noResults: document.getElementById('noResults'),
        tableContainer: document.getElementById('tableContainer'),
        results: document.getElementById('results'),
        wordCount: document.getElementById('wordCount'),
        dbVersion: document.getElementById('dbVersion')
    };
}

function capitalizeFirstLetter(string) {
    if (!string) return '';
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function escapeSql(str) {
    return str.replace(/'/g, "''").replace(/\\/g, "\\\\");
}

async function initDB() {
    // Кэшируем DOM элементы
    cacheElements();
    
    // Ждем загрузки sql.js
    let retries = 50;
    while (retries > 0 && typeof initSqlJs === 'undefined') {
        await new Promise(resolve => setTimeout(resolve, 100));
        retries--;
    }
    
    if (typeof initSqlJs === 'undefined') {
        elements.loadingSpinner.style.display = 'none';
        elements.noResults.style.display = 'block';
        elements.noResults.textContent = 'Ошибка загрузки базы данных. Попробуйте обновить страницу.';
        return;
    }

    const SQL = await initSqlJs({
        locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
    });

    try {
        const response = await fetch('kar_rus.db');
        if (!response.ok) {
            elements.loadingSpinner.style.display = 'none';
            elements.noResults.style.display = 'block';
            elements.noResults.textContent = 'База данных не найдена. Проверьте подключение к интернету.';
            return;
        }
        
        const arrayBuffer = await response.arrayBuffer();
        db = new SQL.Database(new Uint8Array(arrayBuffer));
        
        const countResults = db.exec("SELECT COUNT(*) FROM kar_rus");
        if (countResults.length > 0) {
            totalWords = countResults[0].values[0][0];
        }
        
        elements.dbVersion.textContent = `База словаря ${DB_VERSION} от ${DB_DATE}`;
        elements.wordCount.textContent = `Общее количество слов: ${totalWords}`;
        
        elements.loadingSpinner.style.display = 'none';
        elements.tableContainer.style.display = 'block';
        
        loadWords();
        setupInfiniteScroll();
    } catch (error) {
        elements.loadingSpinner.style.display = 'none';
        elements.noResults.style.display = 'block';
        elements.noResults.textContent = 'База данных не найдена. Добавьте файл kar_rus.db';
    }
}

function loadWords() {
    if (isLoading || !hasMore) return;

    isLoading = true;

    const offset = (currentPage - 1) * perPage;
    const sql = `SELECT * FROM kar_rus LIMIT ${perPage} OFFSET ${offset}`;

    try {
        const results = db.exec(sql);

        if (!results || results.length === 0 || results[0].values.length === 0) {
            hasMore = false;
        } else {
            const columns = results[0].columns;
            const values = results[0].values;

            if (currentPage === 1) {
                elements.results.innerHTML = '';
                elements.noResults.style.display = 'none';
            }

            // Оптимизация: находим индексы один раз вместо вызова indexOf в каждом цикле
            const wordIndex = columns.indexOf('word');
            const translationIndex = columns.indexOf('translation');

            values.forEach(row => {
                const karata = capitalizeFirstLetter(row[wordIndex]);
                const russian = capitalizeFirstLetter(row[translationIndex]);

                const tr = document.createElement('tr');
                const tdKarata = document.createElement('td');
                tdKarata.textContent = karata;
                const tdRussian = document.createElement('td');
                tdRussian.textContent = russian;
                tr.appendChild(tdKarata);
                tr.appendChild(tdRussian);
                elements.results.appendChild(tr);
            });

            currentPage++;

            if (values.length < perPage) {
                hasMore = false;
            }
        }
    } catch (error) {
        hasMore = false;
    }

    isLoading = false;
}

function setupInfiniteScroll() {
    const debouncedLoadWords = debounce(() => {
        if (!isSearching && window.innerHeight + window.scrollY >= document.body.offsetHeight - 500) {
            loadWords();
        }
    }, 100); // 100ms debounce
    
    window.addEventListener('scroll', debouncedLoadWords);
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

let searchTimeout;
document.getElementById('searchInput').addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    const query = e.target.value.trim();

    if (query) {
        elements.searchLoading.style.display = 'block';
    } else {
        elements.searchLoading.style.display = 'none';
    }

    searchTimeout = setTimeout(() => {
        if (query) {
            isSearching = true;
            try {
                const normalizedQuery = query.replace(/[Ii|Ӏ]/g, '1').toLowerCase();
                const escapedQuery = escapeSql(normalizedQuery);
                const sql = `SELECT * FROM kar_rus WHERE word LIKE '%${escapedQuery}%' OR translation LIKE '%${escapedQuery}%' LIMIT 100`;
                const results = db.exec(sql);
                
                if (results.length > 0) {
                    const totalCountSql = `SELECT COUNT(*) FROM kar_rus WHERE word LIKE '%${escapedQuery}%' OR translation LIKE '%${escapedQuery}%'`;
                    const totalCountResult = db.exec(totalCountSql);
                    const totalCountValue = totalCountResult.length > 0 ? totalCountResult[0].values[0][0] : results[0].values.length;
                    
                    displayResults([{columns: results[0].columns, values: results[0].values, totalCount: totalCountValue}]);
                } else {
                    displayResults([]);
                }
            } catch (error) {
                displayResults([]);
            }
        } else {
            currentPage = 1;
            hasMore = true;
            isSearching = false;
            elements.wordCount.textContent = `Общее количество слов: ${totalWords}`;
            loadWords();
        }
    }, 300);
});

function capitalizeFirstLetter(string) {
    if (!string) return '';
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function displayResults(results) {
    elements.searchLoading.style.display = 'none';

    if (!results || results.length === 0 || results[0].values.length === 0) {
        elements.results.innerHTML = '';
        elements.tableContainer.style.display = 'none';
        elements.noResults.style.display = 'block';
        elements.noResults.textContent = 'Слово не найдено';
        elements.wordCount.textContent = 'Количество слов: 0';
        return;
    }

    elements.noResults.style.display = 'none';
    elements.tableContainer.style.display = 'block';

    const columns = results[0].columns;
    const values = results[0].values;
    const totalCount = results[0].totalCount || values.length;

    // Оптимизация: находим индексы один раз вместо вызова indexOf в каждом цикле
    const wordIndex = columns.indexOf('word');
    const translationIndex = columns.indexOf('translation');

    const fragment = document.createDocumentFragment();
    values.forEach(row => {
        const karata = capitalizeFirstLetter(row[wordIndex]);
        const russian = capitalizeFirstLetter(row[translationIndex]);

        const tr = document.createElement('tr');
        const tdKarata = document.createElement('td');
        tdKarata.textContent = karata;
        const tdRussian = document.createElement('td');
        tdRussian.textContent = russian;
        tr.appendChild(tdKarata);
        tr.appendChild(tdRussian);
        fragment.appendChild(tr);
    });

    elements.results.innerHTML = '';
    elements.results.appendChild(fragment);
    
    if (isSearching) {
        elements.wordCount.textContent = `Количество слов: ${totalCount}`;
    }
}

initDB();
