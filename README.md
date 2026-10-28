# Flávio — piloto local

Protótipo de um bot que lê o estado real de [cadeflavio.run](https://cadeflavio.run/?debug), prevê colisões e joga usando comandos de teclado.

**Resultado observado:** no teste final registrado em `reports/validation.json`, atravessou a ponte em 27,4 segundos, entrou na cabine com 4 vidas e fez 544 decisões. Duas execuções anteriores também chegaram à cabine, com 5 vidas; o relatório incluído corresponde à versão final, após a correção do controle manual. Isso comprova essas partidas, não uma taxa de vitória em todas as situações.

## Usar no Brave

O pacote já inclui a extensão pronta na pasta `extension`; não precisa instalar Node ou pagar uma API para jogar.

1. Abra `brave://extensions` no Brave.
2. Ative **Modo do desenvolvedor**.
3. Clique em **Carregar sem compactação** e escolha a pasta **extension** deste projeto.
4. Abra [o jogo com leitura habilitada](https://cadeflavio.run/?debug).
5. No menu de extensões do Brave, clique em **Flávio — piloto local**. Aparecerá o painel no canto inferior direito.
6. Clique em **Iniciar tentativa** e mantenha essa aba e janela em foco.

**Para parar:** clique em Parar, pressione **F8** ou **Escape**, ou saia da aba/janela. Usar as setas ou WASD também interrompe o bot e devolve o controle a você. O bot solta as teclas que pressionou. O jogo continua rodando depois da parada, portanto o personagem pode ser capturado enquanto fica parado.

Se abrir o jogo sem `?debug`, o primeiro clique no ícone recarrega a página para habilitar a leitura e mostra `+1`. Clique no ícone mais uma vez depois de carregar. Essa recarga perde a partida em andamento.

Ao entrar na cabine, o bot para: isso é a conclusão da travessia. O diálogo posterior tem um final narrativo em que o avião não decola. Não há uma segunda corrida implementada neste bot.

Para uma tentativa nova depois de chegar à cabine, recarregue a página e clique novamente no ícone da extensão. Depois de uma captura, **Iniciar tentativa** usa o botão de tentar novamente do próprio jogo.

## O que está fazendo

- Usa o recurso `?debug` que o próprio jogo oferece (`window.__game`). Lê coordenadas e objetos internos, inclusive dados que podem estar fora da tela; não interpreta pixels.
- Não altera vidas, posição, velocidade, inimigos, cancela ou regras. Não chama o atalho de vitória do jogo.
- A cada aproximadamente 50 ms, avalia sequências curtas de movimento com uma previsão de cerca de 1,1 segundo.
- Simula, sobre cópias, patrulhas, perseguição, viaturas, fantasmas, invulnerabilidade e abertura da cancela.
- Envia apenas as mudanças nas teclas necessárias, inclusive movimento diagonal.
- Permite baixar os registros da tentativa em JSON. Mantém no máximo 6.000 registros em memória.

Esta versão usa um **controlador preditivo programado**, sem modelo treinado. Implementa a parte de leitura e controle discutida a partir do vídeo; integrar um modelo de decisões como Jev é trabalho futuro. A decisão pode ser trocada em `src/planner.js`, preservando o executor e a interrupção.

## Permissões e limites

A extensão pede `activeTab` e `scripting`, e só injeta código quando você clica no ícone na origem exata `https://cadeflavio.run`. Não usa servidores de IA, não envia registros e não lê outras abas. Você pode remover a extensão em `brave://extensions`.

É específica para as regras do jogo observadas em 28/10/2026. Mudanças na estrutura dos dados são rejeitadas quando detectáveis; mudanças nas regras ou constantes podem exigir atualização do decisor. Não foi validada em celular, com controles simultâneos de uma pessoa, ou em outros jogos.

## Desenvolvimento

Requer Node.js 20+ para os testes e Brave no macOS para o comando de integração padrão.

```sh
npm test
npm run build
```

O pacote do navegador não depende de bibliotecas. Para repetir o teste de navegador:

```sh
npm install
npm run verify
```

O teste abre um Brave temporário, separado do seu perfil, acessa o jogo real e injeta o mesmo pacote da extensão. Testa F8, Escape, entrada manual, tratamento do evento de perda de foco e exportação dos registros. Observa a partida até captura, entrada na cabine ou limite de tempo. Não instala a extensão no seu perfil. O carregador da extensão tem testes separados de roteamento; a instalação pelo painel do Brave ainda é uma etapa manual. Para outro executável, defina `BROWSER_PATH`; para usar Playwright já instalado, defina `PLAYWRIGHT_MODULE` com o caminho do pacote. `ATTEMPTS` limita tentativas (padrão 3, para no primeiro sucesso).

## Arquivos

- `src/planner.js`: previsão do mundo e escolha do movimento.
- `src/controller.js`: leitura, teclas, painel e interrupção.
- `extension/`: extensão pronta para carregar.
- `scripts/build.mjs`: empacotamento sem dependências.
- `scripts/verify.mjs`: validação no navegador real.
- `reports/validation.json`: resultado registrado.
- `reports/attempt-1.png`: imagem da entrada na cabine.
- `test/`: testes de colisão, cancela, leitura e parada.

O código e os recursos originais do jogo não são redistribuídos neste projeto. O jogo permanece hospedado no site de seu autor.
