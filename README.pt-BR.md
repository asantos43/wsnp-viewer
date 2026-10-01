# WSNP Viewer

<img src="build/icon.png" alt="Ícone do WSNP Viewer: uma página saindo de uma pasta com zíper, com uma lente de câmera" width="96" align="right">

Um visualizador para computador de arquivos **WSNP** (`.wsnp`): páginas da web salvas para ler offline, gravadas pela extensão de navegador
[PageKeep](https://github.com/asantos43/webpage-snapshot). Um `.wsnp` é um **contêiner**: um único arquivo (um ZIP) que guarda uma página, todos os
arquivos de que ela precisa e um manifesto que diz o que é cada um e como conferi-lo. O visualizador abre o arquivo sem descompactá-lo, mostra a
página exatamente como era, confere que ninguém a alterou e não deixa que ela chegue à rede.

Roda no Linux, no Windows e no macOS, é feito com Electron e TypeScript, e tem a aparência e o comportamento dos temas Dark+ e Light+ do Visual Studio Code.
Inglês e português do Brasil, conforme o idioma do sistema. [English](README.md).

![WSNP Viewer mostrando uma página salva, com os arquivos do snapshot na barra lateral](docs/images/workbench-dark.png)

## O que ele faz

- **Abre arquivos `.wsnp`**, vários ao mesmo tempo, cada um na sua aba e no seu quadro isolado: com duplo clique, pelo seletor de arquivos (`Ctrl+O`),
  arrastando o arquivo para a janela ou por **Abrir Recente**. Uma segunda execução entrega o arquivo à janela que já está aberta.
- **Mostra a página como era**, inclusive os scripts do formato (carrosséis, abas, menus), sob uma política rígida: nada que a página tente carregar da
  internet sai do computador. Um link em que você clica abre no seu navegador padrão, nunca dentro da página.
- **Mostra o que há dentro**: os arquivos do snapshot em árvore. Código com cores, imagens com **barra de zoom**, **PDFs** com zoom e navegação de
  páginas, fontes, e **arquivos ZIP** como uma lista da qual se pode selecionar, **extrair** e **exibir** entrada por entrada. Um arquivo que não pode ser exibido (um documento,
  um vídeo) é oferecido com **Salvar Como…**.
- **Localiza, copia e imprime**: `Ctrl+F` procura na página, no código, no PDF, na lista do ZIP ou nos metadados que estão na tela, **Copiar** funciona em todos eles, e a barra
  de atividades tem os ícones **Abrir Arquivo** e **Imprimir**.
- **Confere o arquivo**: a estrutura do formato, o SHA-256 de cada arquivo e uma **assinatura** do manifesto. Um snapshot cujos arquivos não batem com o
  manifesto, ou cujo manifesto assinado foi editado, fica retido como **inválido**. **Mostrar Metadados** lista tudo o que o manifesto diz.
- **Recusa em palavras simples**: "feito por uma versão mais nova", "protegido por senha", "contém um aplicativo que este visualizador ainda não executa", nunca "arquivo quebrado".

| | |
| --- | --- |
| ![Um PDF do snapshot, com a barra de ferramentas](docs/images/pdf-viewer.png) | ![Uma imagem do snapshot, com a barra de zoom](docs/images/image-viewer.png) |
| ![Os metadados de um snapshot e o que foi conferido](docs/images/metadata.png) | ![O tema claro](docs/images/workbench-light.png) |
| ![Um ZIP dentro de um snapshot: seus arquivos, selecionados para extração](docs/images/zip-viewer.png) | ![Localizar na lista, e os menus no estilo do VS Code](docs/images/file-menu.png) |

As imagens mostram a interface em inglês. **Nas próximas fases** (o plano está em [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)): ler um ZIP simples salvo pelo
PageKeep e convertê-lo em `.wsnp`; exportar um snapshot para PNG, JPG e PDF; busca em todos os snapshots abertos e proteção por senha; `.wsnpx` (snapshots com aplicativo).

## Instalação

Os arquivos de release são publicados na [página de Releases](https://github.com/asantos43/wsnp-viewer/releases) quando houver uma primeira versão. Eles **ainda
não são assinados**, então a primeira execução mostra um aviso no Windows e no macOS.

| Sistema | Arquivo | Como |
| --- | --- | --- |
| Windows | `wsnp-viewer-<versão>-win-x64.exe` | Execute. O SmartScreen diz "O Windows protegeu seu PC": escolha **Mais informações** e depois **Executar assim mesmo**. |
| macOS (Apple Silicon e Intel) | `wsnp-viewer-<versão>-mac-universal.dmg` | Abra e arraste o aplicativo para Aplicativos. Na primeira vez, clique com o botão direito no aplicativo e escolha **Abrir**, ou permita em **Ajustes do Sistema › Privacidade e Segurança**. |
| Debian, Ubuntu | `wsnp-viewer-<versão>-linux-amd64.deb` | `sudo apt install ./wsnp-viewer-<versão>-linux-amd64.deb` |
| Fedora, Red Hat | `wsnp-viewer-<versão>-linux-x86_64.rpm` | `sudo dnf install ./wsnp-viewer-<versão>-linux-x86_64.rpm` |

Os instaladores registram o `.wsnp`, então um duplo clique abre o arquivo no visualizador (no Linux o tipo do arquivo se distingue de um ZIP comum pela
primeira entrada, mesmo sem a extensão). Não há AppImage.

## Compilar a partir do código

Você precisa do Node.js 22 ou mais novo.

```sh
npm ci
npm run app            # compila e inicia o aplicativo
npm test               # testes unitários e de componente
npm run test:e2e       # o aplicativo de verdade, conduzido pelo Playwright
npm run package:linux  # ou package:win, package:mac: os arquivos de release, em release/
```

Mais em [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) (em inglês), e como as mudanças são feitas em [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Privacidade e segurança

Sem conta, sem análise de uso, sem uso da rede exceto um link da web em que você clicar. O que fica no seu computador, e o que não fica, está em
[`PRIVACY.md`](PRIVACY.md). Como um arquivo hostil é tratado e como relatar uma vulnerabilidade está em [`SECURITY.md`](SECURITY.md).

## Documentação

| | |
| --- | --- |
| [`docs/USER-GUIDE.pt-BR.md`](docs/USER-GUIDE.pt-BR.md) ([en](docs/USER-GUIDE.md)) | Abrir arquivos, abas, verificações, links, atalhos, configurações |
| [`docs/FORMAT.md`](docs/FORMAT.md) | O formato de arquivo WSNP (compartilhado com o PageKeep; em inglês) |
| [`docs/MANIFEST-SIGNING.md`](docs/MANIFEST-SIGNING.md) | Como o manifesto é assinado e quem controla as chaves (em inglês) |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Decisões, plano, fases e medições (em inglês) |
| [`CHANGELOG.md`](CHANGELOG.md) | O que mudou, por versão |
| [`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md) | As bibliotecas dentro do aplicativo e suas licenças |

A interface é *inspirada* no Visual Studio Code. O WSNP Viewer não é o Visual Studio Code, nem tem o apoio da Microsoft.

## Licença

MIT. Veja [`LICENSE`](LICENSE).
