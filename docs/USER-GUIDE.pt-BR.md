# Guia do usuário

O WSNP Viewer abre **arquivos `.wsnp`**: páginas da web salvas pela extensão [PageKeep](https://github.com/asantos43/webpage-snapshot) para ler offline. Um `.wsnp`
é um **contêiner**, um único arquivo que guarda uma página, todos os arquivos de que ela precisa e um manifesto que os descreve. [English](USER-GUIDE.md).

## Abrindo arquivos

- **Duplo clique** num `.wsnp` (os instaladores registram o tipo de arquivo), ou **Arquivo › Abrir Arquivo…** (`Ctrl+O`, `⌘O` no macOS).
- **Arraste** um ou mais arquivos para a janela.
- **Arquivo › Abrir Recente** lista os arquivos abertos há pouco; **Limpar Abertos Recentemente** esvazia a lista.
- Abrir um segundo arquivo com o aplicativo em execução acrescenta uma aba à mesma janela. Um arquivo que já está aberto apenas mostra a aba dele.

Um arquivo que não pode ser aberto diz por quê, em palavras: por exemplo "feito por uma versão mais nova do formato", "protegido por senha, e esta versão ainda não
abre arquivos protegidos" ou "contém um aplicativo que este visualizador ainda não consegue executar". Um erro fica na tela até você dispensá-lo; uma informação some sozinha.

## A janela

![A janela: barra de título, barra de atividades, barra lateral, abas, editor e barra de status](images/workbench-dark.png)

Ela é organizada como o Visual Studio Code: uma **barra de título** com o menu, uma **barra de atividades**, uma **barra lateral**, as **abas** com o caminho (breadcrumbs) embaixo,
a página ou o arquivo no meio e uma **barra de status**. `Ctrl+B` oculta e mostra a barra lateral. Arraste a borda da barra lateral para redimensioná-la; o tamanho é lembrado.
(As imagens mostram a interface em inglês.)

### Abas

- Cada snapshot abre numa aba. Um clique num arquivo da barra lateral abre uma **aba de prévia** (o nome em itálico) que o próximo clique substitui; um duplo clique
  (ou Enter) a **mantém**.
- Feche com o × da aba, um clique com o botão do meio ou `Ctrl+W`. **Arraste** uma aba para movê-la. O menu de contexto da aba tem Fechar, Fechar Outros, Fechar à Direita,
  Fechar Todos, Fixar, **Mostrar Metadados**, Copiar Endereço de Origem (ou Copiar Caminho) e Mostrar no Gerenciador de Arquivos.
- `Ctrl+Tab` percorre as abas na ordem em que você as usou; `Alt+1…9` vai para a enésima aba (`⌘1…9` no macOS).
- Um snapshot mantém o estado (rolagem, um carrossel no item 3) enquanto você olha outra aba.

### A barra lateral

- **Snapshots Abertos**: os snapshots que estão abertos.
- **Arquivos**: os arquivos do snapshot selecionado em árvore. As setas se movem, digitar pula para um nome, Enter mantém um arquivo aberto, e o menu de contexto tem
  **Salvar Como…** para todo arquivo.
- **Informações**: de onde a página veio, quando e com quê. **Mostrar todos os metadados…** abre a visão completa.
- **Integridade**: o resultado da verificação de cada arquivo.

## O que uma aba pode mostrar

| Arquivo | O que você vê |
| --- | --- |
| O próprio snapshot | A página, como era, com os scripts do formato funcionando (carrosséis, abas, menus). |
| HTML, CSS, JavaScript, JSON, texto, SVG | Código com cores e numeração de linhas, somente leitura. |
| Imagens | A imagem com uma **barra de ferramentas**: reduzir e ampliar, uma caixa (Ajustar, Ajustar à Largura, Ajustar à Página, 25 % a 400 % e mais), tamanho real (1:1), **Salvar Como…**. `Ctrl` e a roda ampliam em torno do ponteiro, `+` `-` `0` ampliam pelo teclado, e uma imagem ampliada pode ser arrastada. O zoom fica com a aba. |
| PDFs | As páginas, uma após a outra, com texto selecionável, e uma **barra de ferramentas**: o mesmo zoom, página anterior e próxima, uma caixa para ir a uma página, **Salvar Como…**. Ainda não: links e formulários dentro do PDF, e senha de um PDF protegido (ele avisa, e pode ser salvo). |
| Fontes | Uma amostra em vários tamanhos. |
| Qualquer outra coisa (um ZIP, um documento, áudio, vídeo, um arquivo grande demais) | Uma página com o nome, o tipo e o tamanho, e **Salvar Como…**. |

Um clique num link **dentro de uma página**: um link `#seção` rola na página; um link para um arquivo salvo no snapshot abre uma aba (uma imagem, um PDF, código) ou oferece
**Salvar Como…** (um ZIP ou um documento); um link para a web abre o seu **navegador padrão**, só quando você clica, e nunca dentro da página.

## Conferindo um arquivo

O visualizador confere um arquivo quando o abre, e de novo em segundo plano:

1. **Estrutura**: o ZIP, a entrada de identificação, o manifesto, os nomes das entradas e se todo arquivo está listado.
2. **Conteúdo**: o SHA-256 e o tamanho de cada arquivo contra o manifesto (a barra de status mostra *Verificando…* e depois *Intacto*).
3. **Assinatura**: se o manifesto é assinado, e se ainda é o que foi assinado.

![A aba de metadados: o que o manifesto diz e o que foi conferido](images/metadata.png)

### Um snapshot que não é válido

Um `.wsnp` é um ZIP, então qualquer pessoa pode descompactá-lo, mudar um arquivo ou o manifesto e compactá-lo de novo. Se um arquivo não é o que o manifesto diz, ou um manifesto
assinado foi editado, o snapshot **não é válido**: a página dele não é exibida. Você vê quais arquivos e escolhe **Mostrar Mesmo Assim**, **Fechar Snapshot** ou **Mostrar Metadados**.
A barra de status diz *Inválido*.

### Assinaturas

O PageKeep assina todo `.wsnp` que grava, com uma chave que fica no seu navegador. O visualizador mostra o **assinante** como uma impressão digital (`5647-5AA7-…`):

- **Sem assinatura**: arquivos gravados antes de o PageKeep começar a assinar. Eles abrem, e o visualizador diz discretamente que os metadados deles não são protegidos: alguém poderia tê-los editado.
- **Assinado por uma chave que este visualizador ainda não conhece**: a assinatura é boa (o manifesto não foi editado depois de assinado), mas qualquer pessoa pode criar uma chave. Se você sabe que
  é a sua (a Ajuda do PageKeep mostra a impressão digital da sua), escolha **Confiar neste assinante** em **Mostrar Metadados** e, se quiser, dê um nome a ela.
- **Assinado por** um nome que você deu: uma chave em que você confia. **Deixar de confiar** desfaz.

O desenho está em [`MANIFEST-SIGNING.md`](MANIFEST-SIGNING.md) (em inglês).

## Atalhos

| Ação | Windows, Linux | macOS |
| --- | --- | --- |
| Abrir Arquivo | `Ctrl+O` | `⌘O` |
| Fechar a aba | `Ctrl+W` | `⌘W` |
| Próxima / anterior aba | `Ctrl+PageDown` / `Ctrl+PageUp` | `⌘PageDown` / `⌘PageUp` |
| Pelas abas, a usada há menos tempo primeiro | `Ctrl+Tab`, `Ctrl+Shift+Tab` | `⌃Tab`, `⌃⇧Tab` |
| Ir para a aba 1…9 | `Alt+1…9` | `⌘1…9` |
| Ocultar / mostrar a barra lateral | `Ctrl+B` | `⌘B` |
| Configurações | `Ctrl+,` | `⌘,` |
| Zoom da interface: ampliar / reduzir / redefinir | `Ctrl+=` / `Ctrl+-` / `Ctrl+0` | `⌘=` / `⌘-` / `⌘0` |
| Zoom de uma imagem ou de um PDF | `Ctrl` + roda, ou `+` `-` `0` com o visualizador em foco | o mesmo |

Os atalhos funcionam onde estiver o foco, também dentro de uma página.

## Configurações

**Configurações** (a engrenagem no fim da barra de atividades, Arquivo › Configurações ou `Ctrl+,`) abre numa aba, com uma caixa que as filtra:

- **Tema de Cores**: Dark+, Light+ ou Automático, que segue o sistema operacional.
- **Idioma de Exibição**: inglês, português do Brasil ou automático (o do sistema). A mudança é imediata.
- **Nível de Zoom**: o zoom da interface inteira, 20 % por passo.

As configurações ficam no seu computador, na pasta do próprio aplicativo, e em nenhum outro lugar. Veja [`../PRIVACY.md`](../PRIVACY.md) (em inglês).

## Ajuda e Sobre

**Ajuda › Sobre o WSNP Viewer** mostra a versão, em que ele roda, a licença e os avisos das bibliotecas que há dentro dele, e copia as informações da versão para um relato de problema.
Relate um problema em <https://github.com/asantos43/wsnp-viewer/issues>, **sem anexar um snapshot privado**; uma vulnerabilidade segue o que diz [`../SECURITY.md`](../SECURITY.md).

## O que ainda não existe

Ler um ZIP simples salvo pelo PageKeep e convertê-lo, exportar para PNG, JPG e PDF, busca, impressão, proteção por senha e `.wsnpx` vêm em fases posteriores
([`ARCHITECTURE.md`](ARCHITECTURE.md), "Phases").
