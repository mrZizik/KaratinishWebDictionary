let db = null;
let currentPage = 1;
const perPage = 100;
let isLoading = false;
let hasMore = true;
let totalWords = 0;
let isSearching = false;

const DB_VERSION = 'v1.0';
const DB_DATE = '25.12.2025';

function escapeSql(str) {
    return str.replace(/'/g, "''").replace(/\\/g, "\\\\");
}

async function initDB() {
    const SQL = await initSqlJs({
        locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
    });

    try {
        const response = await fetch('kar_rus.db');
        const arrayBuffer = await response.arrayBuffer();
        db = new SQL.Database(new Uint8Array(arrayBuffer));
        
        const countResults = db.exec("SELECT COUNT(*) FROM kar_rus");
        if (countResults.length > 0) {
            totalWords = countResults[0].values[0][0];
        }
        
        document.getElementById('dbVersion').textContent = `База словаря ${DB_VERSION} от ${DB_DATE}`;
        updateWordCount();
        
        loadWords();
        setupInfiniteScroll();
    } catch (error) {
        console.error('Ошибка загрузки базы:', error);
        document.getElementById('loadingSpinner').style.display = 'none';
        document.getElementById('noResults').style.display = 'block';
        document.getElementById('noResults').textContent = 'База данных не найдена. Добавьте файл kar_rus.db';
    }
}

function updateWordCount() {
    const wordCountEl = document.getElementById('wordCount');
    if (isSearching) {
        const rowCount = document.getElementById('results').children.length;
        wordCountEl.textContent = `Количество слов: ${rowCount}`;
    } else {
        wordCountEl.textContent = `Общее количество слов: ${totalWords}`;
    }
}

function resetAndLoad() {
    currentPage = 1;
    hasMore = true;
    isSearching = false;
    updateWordCount();
    loadWords();
}

function loadWords() {
    if (isLoading || !hasMore) return;

    isLoading = true;

    const offset = (currentPage - 1) * perPage;
    const sql = `SELECT * FROM kar_rus LIMIT ${perPage} OFFSET ${offset}`;

    const results = db.exec(sql);

    if (!results || results.length === 0 || results[0].values.length === 0) {
        hasMore = false;
    } else {
        const columns = results[0].columns;
        const values = results[0].values;

        if (currentPage === 1) {
            document.getElementById('results').innerHTML = '';
            document.getElementById('noResults').style.display = 'none';
            document.getElementById('loadingSpinner').style.display = 'none';
            document.getElementById('tableContainer').style.display = 'block';
            if (!isSearching) {
                updateWordCount();
            }
        }

        const tbody = document.getElementById('results');

        values.forEach(row => {
            const karata = row[columns.indexOf('word')];
            const russian = row[columns.indexOf('translation')];

            const tr = document.createElement('tr');
            const tdKarata = document.createElement('td');
            tdKarata.textContent = karata;
            const tdRussian = document.createElement('td');
            tdRussian.textContent = russian;
            tr.appendChild(tdKarata);
            tr.appendChild(tdRussian);
            tbody.appendChild(tr);
        });

        currentPage++;

        if (values.length < perPage) {
            hasMore = false;
        }
    }

    isLoading = false;
}

function setupInfiniteScroll() {
    window.addEventListener('scroll', () => {
        if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 500) {
            loadWords();
        }
    });
}

let searchTimeout;
document.getElementById('searchInput').addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    const query = e.target.value.trim();

    if (query) {
        document.getElementById('searchLoading').style.display = 'block';
    } else {
        document.getElementById('searchLoading').style.display = 'none';
    }

        searchTimeout = setTimeout(() => {
        if (query) {
            isSearching = true;
            const queryLower = query.toLowerCase();
            const allResults = db.exec("SELECT * FROM kar_rus");
            if (allResults.length > 0) {
                const columns = allResults[0].columns;
                const values = allResults[0].values;
                const filtered = values.filter(row => {
                    const word = row[columns.indexOf('word')].toLowerCase();
                    const translation = row[columns.indexOf('translation')].toLowerCase();
                    return word.includes(queryLower) || translation.includes(queryLower);
                });
                const totalCount = filtered.length;
                const displayData = filtered.slice(0, 100);
                displayResults([{columns: columns, values: displayData, totalCount: totalCount}]);
            } else {
                displayResults([]);
            }
        } else {
            resetAndLoad();
        }
    }, 300);
});

function displayResults(results) {
    const tbody = document.getElementById('results');
    const noResults = document.getElementById('noResults');
    const tableContainer = document.getElementById('tableContainer');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const searchLoading = document.getElementById('searchLoading');

    searchLoading.style.display = 'none';

    if (!results || results.length === 0 || results[0].values.length === 0) {
        tbody.innerHTML = '';
        tableContainer.style.display = 'none';
        noResults.style.display = 'block';
        noResults.textContent = 'Слово не найдено';
        document.getElementById('wordCount').textContent = 'Количество слов: 0';
        return;
    }

    noResults.style.display = 'none';
    tableContainer.style.display = 'block';

    const columns = results[0].columns;
    const values = results[0].values;
    const totalCount = results[0].totalCount || values.length;

    const fragment = document.createDocumentFragment();
    values.forEach(row => {
        const karata = row[columns.indexOf('word')];
        const russian = row[columns.indexOf('translation')];

        const tr = document.createElement('tr');
        const tdKarata = document.createElement('td');
        tdKarata.textContent = karata;
        const tdRussian = document.createElement('td');
        tdRussian.textContent = russian;
        tr.appendChild(tdKarata);
        tr.appendChild(tdRussian);
        fragment.appendChild(tr);
    });

    tbody.innerHTML = '';
    tbody.appendChild(fragment);
    
    if (isSearching) {
        document.getElementById('wordCount').textContent = `Количество слов: ${totalCount}`;
    }
}

initDB();
