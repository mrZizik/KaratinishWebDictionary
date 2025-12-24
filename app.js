let db = null;
let currentPage = 1;
const perPage = 100;
let isLoading = false;
let hasMore = true;

async function initDB() {
    const SQL = await initSqlJs({
        locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
    });
    
    try {
        const response = await fetch('kar_rus.db');
        const arrayBuffer = await response.arrayBuffer();
        db = new SQL.Database(new Uint8Array(arrayBuffer));
        loadWords();
        setupInfiniteScroll();
    } catch (error) {
        console.error('Ошибка загрузки базы:', error);
        document.getElementById('noResults').style.display = 'block';
        document.getElementById('noResults').textContent = 'База данных не найдена. Добавьте файл kar_rus.db';
    }
}

function resetAndLoad() {
    currentPage = 1;
    hasMore = true;
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
        }
        
        const tbody = document.getElementById('results');
        
        values.forEach(row => {
            const karata = row[columns.indexOf('word')];
            const russian = row[columns.indexOf('translation')];
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${karata}</td>
                <td>${russian}</td>
            `;
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
    
    searchTimeout = setTimeout(() => {
        if (query) {
            const results = db.exec(`SELECT * FROM kar_rus WHERE word LIKE '%${query}%' OR translation LIKE '%${query}%' LIMIT 100`);
            displayResults(results);
        } else {
            resetAndLoad();
        }
    }, 300);
});

function displayResults(results) {
    const tbody = document.getElementById('results');
    const noResults = document.getElementById('noResults');
    
    if (!results || results.length === 0 || results[0].values.length === 0) {
        tbody.innerHTML = '';
        noResults.style.display = 'block';
        noResults.textContent = 'Ничего не найдено';
        return;
    }
    
    noResults.style.display = 'none';
    
    const columns = results[0].columns;
    const values = results[0].values;
    
    let html = '';
    values.forEach(row => {
        const karata = row[columns.indexOf('word')];
        const russian = row[columns.indexOf('translation')];
        
        html += `
            <tr>
                <td>${karata}</td>
                <td>${russian}</td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
}

initDB();
