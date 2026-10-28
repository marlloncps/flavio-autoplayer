# Flávio — piloto local · blaster · versão 0.5

Protótipo de um bot que lê o estado real de [cadeflavio.run](https://cadeflavio.run/?debug), prevê colisões e joga usando comandos de teclado.

**Resultado observado na velocidade original:** no teste registrado em `reports/validation.json`, atravessou a ponte em 26,9 segundos, entrou na cabine com 2 vidas e fez 534 decisões. Três execuções anteriores também chegaram à cabine, com 5, 5 e 4 vidas. Esse relatório corresponde à versão anterior à inclusão dos controles experimentais de velocidade. Isso comprova essas partidas, não uma taxa de vitória em todas as situações.

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
- Não altera vidas, posição ou cancela, e não chama o atalho de vitória do jogo. A velocidade fica original por padrão; só é modificada pelo controle experimental. O mod de arma remove os alvos atingidos pelos seus projéteis, conforme solicitado.
- A cada aproximadamente 50 ms, avalia sequências curtas de movimento com uma previsão de cerca de 1,1 segundo.
- Simula, sobre cópias, patrulhas, perseguição, viaturas, fantasmas, invulnerabilidade e abertura da cancela.
- Envia apenas as mudanças nas teclas necessárias, inclusive movimento diagonal.
- Permite baixar os registros da tentativa em JSON. Mantém no máximo 6.000 registros em memória.

## Caixas e modo de gravação — versão 0.2

As caixas aparecem automaticamente durante a travessia. Cada tipo tem uma cor: verde para o personagem, azul para PRF, rosa para manifestantes, laranja para viaturas e roxo para fantasmas. Vermelho destaca proximidade. As etiquetas mostram o tipo e a distância em unidades do jogo.

- **V** ou **Caixas: ligadas**: mostrar/esconder a camada visual.
- **G** ou **Modo gravação**: recolher os controles para deixar o jogo em destaque. Pressione G novamente para expandir.
- **Seta verde**: direção do comando atual, projetada por um curto intervalo. Não representa toda a sequência futura calculada pelo decisor.
- **Rastro tracejado**: caminho que o personagem realmente percorreu.
- **Contornos tracejados pequenos**: regiões de colisão do motor; as caixas maiores aproximam o tamanho visual dos desenhos.

As caixas acompanham a câmera e o tamanho do jogo. O efeito de tremor do próprio jogo pode causar um pequeno deslocamento visual temporário. Não são detecções de visão computacional: usam os dados internos disponíveis no modo debug, como o restante do bot.

**Se você já carregou a versão anterior:** em `brave://extensions`, clique em **Recarregar** no cartão da extensão. Depois recarregue a página do jogo e clique no ícone da extensão novamente. Não precisa selecionar a pasta de novo.

Para gravar por conta própria, inicie a tentativa e pressione **G**. Use a gravação de tela do macOS (**⌘ Shift 5**) e mantenha o Brave em foco durante a partida. F8 e Escape continuam parando o bot.

Esta versão usa um **controlador preditivo programado**, sem modelo treinado. Implementa a parte de leitura e controle discutida a partir do vídeo; integrar um modelo de decisões como Jev é trabalho futuro. A decisão pode ser trocada em `src/planner.js`, preservando o executor e a interrupção.

## Velocidade experimental — versão 0.4

No painel expandido, use **1× original**, **2×**, **3×** ou **20×**. Pode ajustar antes de iniciar ou durante a partida, tanto com o bot quanto jogando manualmente.

- **1× original:** restaura a velocidade capturada ao ativar a extensão (245 unidades/s na versão testada do jogo).
- **2×:** dobra a velocidade do personagem; **3×:** triplica.
- **20×:** opção extrema, 4.900 unidades/s na versão testada. O painel mantém a indicação de velocidade modificada.
- Recarregar a página restaura o padrão. Tentar novamente sem recarregar mantém a seleção.
- Parar o bot não restaura automaticamente a velocidade; use **1× original** para isso.
- O painel mostra **Velocidade modificada** inclusive no modo de gravação. O JSON exportado inclui o multiplicador e a velocidade de cada decisão.

Esse controle modifica explicitamente `player.speed` no jogo local, conforme solicitado. Os resultados com 2×/3×/20× são experimentos com uma regra modificada e devem ser distinguidos das partidas na velocidade original.

No teste registrado em `reports/speed-validation.json`, chegou à cabine com 5 vidas em aproximadamente 14,7 s a 2× e 8,8 s a 3×. Restauração e recarga foram verificadas. `npm run verify:speed` repete esse teste em um navegador isolado.

O teste separado de **20×** chegou à cabine em aproximadamente **1,5 s**, com 4 vidas, e confirmou a restauração para 1×. Resultado em `reports/speed20-validation.json`.

## Blaster — versão 0.5

O personagem agora carrega um blaster visível, com mira automática, projéteis luminosos, recuo e efeito de impacto. É um **mod local**: o jogo observado não tinha um sistema nativo de tiros. Um acerto remove somente o alvo atingido do motor, incluindo PRF, manifestantes, viaturas, fantasmas e o novo perseguidor Constituição. Não destrói a cancela nem o cenário.

- **Iniciar tentativa:** o bot se move e atira automaticamente nos alvos próximos e visíveis.
- **J:** segure para atirar manualmente, inclusive com o bot parado. O botão **Atirar · J** dispara uma vez. A mira continua automática.
- **Auto: ligado/desligado:** controla o disparo automático do bot. O tiro manual continua disponível.
- **Arma: ligada/desligada:** equipa ou desativa o blaster. Desativar cancela os projéteis em voo; alvos já removidos só retornam ao reiniciar/recarregar a partida.
- **F8/Escape**, Parar, perda de foco e troca de aba interrompem o movimento do bot e cancelam o gatilho e os projéteis. Você pode voltar a atirar pressionando J novamente.
- **V** esconde apenas as caixas; a arma e os tiros continuam visíveis. **G** recolhe os controles e mantém o contador de disparos/acertos.

Os registros JSON incluem disparos, acertos, tipos de alvo e eventos de impacto. A atualização também reconhece o novo perseguidor Constituição na previsão e nas caixas. A validação usa a dificuldade normal do site observado em 28/10/2026.

Se já usa a extensão, recarregue seu cartão em `brave://extensions`, recarregue o jogo e ative novamente pelo ícone. O pacote pronto está em `extension/`.

Para repetir o teste de tiro manual, interrupção, desativação e partidas automáticas a 1×/20×, execute `npm run verify:weapon` com o mesmo requisito de Playwright dos outros testes. Resultado em `reports/weapon-validation.json`.

Na execução registrada com o blaster, chegou à cabine a 1× com **5 vidas, 71 disparos e 39 acertos**. A 20× chegou com 4 vidas. São resultados de partidas com o mod de arma ativo.

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

`npm run demo` também verifica os controles visuais, salva imagens da partida em `reports/` e grava um WebM temporário. O caminho do vídeo aparece no relatório `reports/visual-validation.json`. Esse comando usa o mesmo navegador isolado e o mesmo requisito de Playwright do teste de integração.

O teste abre um Brave temporário, separado do seu perfil, acessa o jogo real e injeta o mesmo pacote da extensão. Testa F8, Escape, entrada manual, tratamento do evento de perda de foco e exportação dos registros. Observa a partida até captura, entrada na cabine ou limite de tempo. Não instala a extensão no seu perfil. O carregador da extensão tem testes separados de roteamento; a instalação pelo painel do Brave ainda é uma etapa manual. Para outro executável, defina `BROWSER_PATH`; para usar Playwright já instalado, defina `PLAYWRIGHT_MODULE` com o caminho do pacote. `ATTEMPTS` limita tentativas (padrão 3, para no primeiro sucesso).

## Arquivos

- `src/planner.js`: previsão do mundo e escolha do movimento.
- `src/controller.js`: leitura, teclas, painel e interrupção.
- `src/overlay.js`: caixas, câmera, rastro e indicação visual da ação.
- `src/speed.js`: ajuste opcional e restauração da velocidade do personagem.
- `src/weapon.js`: projéteis, mira e colisões com os alvos reais.
- `src/weapon-view.js`: arma, tiros e efeitos de impacto sobre o jogo.
- `extension/`: extensão pronta para carregar.
- `scripts/build.mjs`: empacotamento sem dependências.
- `scripts/verify.mjs`: validação no navegador real.
- `reports/validation.json`: resultado registrado.
- `reports/attempt-1.png`: imagem da entrada na cabine.
- `test/`: testes de colisão, cancela, leitura e parada.

O código e os recursos originais do jogo não são redistribuídos neste projeto. O jogo permanece hospedado no site de seu autor.
