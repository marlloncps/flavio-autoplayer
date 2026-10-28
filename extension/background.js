chrome.action.onClicked.addListener(async (tab) => {
  try {
    const url = new URL(tab.url);
    if (url.origin !== 'https://cadeflavio.run') {
      await chrome.action.setBadgeText({ tabId: tab.id, text: 'JOGO' });
      return;
    }
    if (!url.searchParams.has('debug')) {
      url.searchParams.set('debug', '');
      // Primeiro clique habilita a leitura; segundo clique instala o painel.
      await chrome.tabs.update(tab.id, { url: url.href });
      await chrome.action.setBadgeText({ tabId: tab.id, text: '+1' });
      return;
    }
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'MAIN',
      files: ['bot.js'],
    });
    await chrome.action.setBadgeText({ tabId: tab.id, text: '' });
  } catch (error) {
    console.error('Não foi possível ativar o piloto:', error.message);
    await chrome.action.setBadgeText({ tabId: tab.id, text: 'ERRO' });
  }
});
