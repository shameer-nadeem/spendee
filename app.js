const tabs = document.querySelectorAll('#tabs button');
const screens = document.querySelectorAll('.screen');

function show(name) {
  tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  screens.forEach(s => s.classList.toggle('active', s.id === name));
}

tabs.forEach(t => t.addEventListener('click', () => show(t.dataset.tab)));

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js');
}
