if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').then((reg) => {
        console.log('Service Worker зарегистрирован', reg);
    }).catch((err) => {
        console.log('Service Worker ошибка:', err);
    });
}
