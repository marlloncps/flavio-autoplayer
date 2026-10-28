# Contribuir

Obrigado pelo interesse no experimento! Para relatar um problema, abra uma issue com o comportamento esperado, o observado e os passos para reproduzir. Informe a versão da extensão, o navegador, a dificuldade e quais mods estavam ativos. Evite dados pessoais nos registros compartilhados.

## Preparar e verificar

```sh
npm ci
npm test
npm run build
npm run format:check
```

Edite os módulos em `src/`, não o bundle gerado `extension/bot.js`. Inclua o bundle atualizado quando alterar os módulos ou o build. Use `npm run format` para padronizar o código. Testes ficam em `test/`; os testes de navegador e suas dependências estão descritos no README.

## Mudanças de comportamento

Explique o problema concreto, a alteração e como verificou o resultado. Preserve os atalhos de parada e identifique no painel e nos registros qualquer mod que altere regras do jogo. Resultados de testes devem declarar dificuldade, velocidade e arma ativa/desativada.

Os relatórios históricos em `reports/` são evidência de execuções específicas. Uma nova execução pode atualizá-los localmente; confira o diff antes de incluí-la numa contribuição. Vídeos temporários, logs completos e arquivos locais não precisam entrar no Git.

O jogo original permanece no site do criador. Não inclua seu HTML, código ou recursos no projeto.
