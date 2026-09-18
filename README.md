# STL to BGSD

Conversor e planejador local de inserts para jogos de tabuleiro. O projeto le
arquivos STL, identifica evidencias geometricas da peca e gera OpenSCAD editavel
compativel com a **Boardgame Insert Toolkit (BIT)** e com o **BGSD**.

O sistema tambem importa inventarios de pecas em 3MF para planejar um insert
novo, renderiza o SCAD novamente em STL por meio do OpenSCAD e compara a
reconstrucao com o STL original.

> O objetivo e reconstruir um modelo parametrico util e editavel. Um STL contem
> triangulos, mas nao guarda o historico CAD nem a intencao do autor. Por isso,
> algumas propriedades podem ser inferidas e outras precisam ser revisadas.

## Estado atual

- interface web local para importar e configurar varios STL;
- leitura de STL ASCII e binario;
- medicao da caixa delimitadora, escala, paredes e fundo;
- deteccao de paredes retas e multiplos compartimentos;
- inferencia individual da altura de fundos planos;
- cavidades com profundidades diferentes no mesmo insert;
- classificacao aproximada `SQUARE`, `ROUND`, `FILLET`, `HEX`, `HEX2`, `OCT` e `OCT2`;
- inferencia de aberturas laterais e recortes para os dedos;
- preservacao de alguns degraus ortogonais do contorno externo;
- configuracao de paredes, fundo, folgas, tampa, labels e recortes;
- orientacao horizontal ou vertical do nome da tampa;
- edicao individual das dimensoes dos compartimentos;
- pacote SCAD com a biblioteca BIT incluida;
- renderizacao SCAD para STL usando OpenSCAD local;
- progresso de renderizacao com tempo decorrido e estimativa;
- comparacao de fidelidade entre original e reconstrucao;
- importacao de pecas 3MF e planejamento de um novo insert;
- suporte aos 112 parametros publicos da BIT por configuracao JSON;
- conversao em lote e testes automatizados.

A matriz detalhada da biblioteca esta em [BIT-COVERAGE.md](BIT-COVERAGE.md).

## Como funciona

### Reconstrucao de STL

1. Le triangulos, limites, dimensoes, normais, areas e planos.
2. Procura pares de planos que representem paredes e divisorias.
3. Divide o interior em compartimentos candidatos.
4. Analisa as faces horizontais de cada compartimento.
5. Infere a altura do fundo e a profundidade Z de cada cavidade.
6. Analisa paredes e lacunas para inferir formato e recortes.
7. Gera um `OBJECT_BOX` com seus respectivos `BOX_FEATURE`.
8. Permite revisar os valores antes de baixar SCAD ou renderizar STL.

Para cavidades poligonais, `HEX`/`HEX2` e `OCT`/`OCT2` representam as duas
orientacoes suportadas pelo BIT. O conversor tenta escolher a orientacao pelas
normais das paredes do STL. Uma escolha feita no campo **Formato** da interface
passa a ser manual e tem prioridade sobre essa inferencia.

A inferencia de alturas funciona melhor quando cada cavidade possui um fundo
horizontal plano e com area suficiente para ser reconhecida. Uma cavidade funda
e outra rasa podem gerar valores Z diferentes no mesmo SCAD.

### Projeto criado a partir de 3MF

O 3MF e usado como inventario de pecas, nao como insert pronto:

1. O servidor extrai meshes, nomes, unidades, componentes e copias.
2. A interface apresenta quantidade e dimensoes de cada peca.
3. O usuario informa as dimensoes internas da caixa do jogo.
4. O planejador distribui cavidades retangulares.
5. O resultado vira um novo insert BGSD/BIT editavel.

O planejador usa caixas delimitadoras alinhadas aos eixos e pode empilhar copias
iguais verticalmente. Ele ainda nao cria encaixes seguindo o contorno exato.

## Requisitos

### Obrigatorios

- Windows, Linux ou macOS;
- [Node.js](https://nodejs.org/) 18 ou mais recente;
- npm, incluido com o Node.js.

### Para gerar STL e validar fidelidade

- [OpenSCAD](https://openscad.org/) instalado.

No Windows, o servidor procura automaticamente por:

```text
C:\Program Files\OpenSCAD\openscad.exe
```

Se estiver em outro local:

```powershell
$env:OPENSCAD_PATH = "D:\Aplicativos\OpenSCAD\openscad.exe"
```

## Instalacao

```powershell
git clone https://github.com/caiquedevjs/stl-to-scad.git
cd stl-to-scad
npm install
```

As dependencias Node sao usadas principalmente para ZIP/XML do formato 3MF. A
biblioteca BIT ja esta em `lib/boardgame_insert_toolkit_lib.4.scad`.

## Inicio rapido

### Windows

Execute:

```text
abrir-interface-stl-bgsd.cmd
```

O script inicia o servidor local e abre o navegador. Tambem existe o inicializador:

```text
STL-to-BGSD-GUI.exe
```

O executavel e apenas um inicializador; Node.js, dependencias e arquivos do
projeto ainda precisam estar disponiveis.

### Qualquer sistema operacional

```powershell
node .\tools\gui-server.js --open
```

Acesse `http://127.0.0.1:43721/`.

Outra porta pode ser selecionada assim:

```powershell
node .\tools\gui-server.js --port=5500 --open
```

ou pela variavel `STL_BGSD_GUI_PORT`.

## Executar com Docker

Docker empacota Node.js, dependencias npm, OpenSCAD, display virtual e biblioteca
BIT. Na outra maquina, basta instalar Docker Desktop ou Docker Engine; nao e
necessario instalar Node.js e OpenSCAD separadamente.

### Docker Compose

Construa e inicie o servico:

```powershell
docker compose up --build -d
```

Abra:

```text
http://localhost:43721/
```

Consulte o estado e os logs:

```powershell
docker compose ps
docker compose logs -f stl-to-bgsd
```

Pare o ambiente com:

```powershell
docker compose down
```

Depois do primeiro build, as proximas inicializacoes podem usar somente:

```powershell
docker compose up -d
```

### Docker sem Compose

```powershell
docker build -t stl-to-bgsd .
docker run --name stl-to-bgsd --rm -p 43721:43721 stl-to-bgsd
```

A imagem executa OpenSCAD com `xvfb`, permitindo renderizacao sem interface
grafica. O endpoint `/api/health` e usado pelo health check do contêiner.

Downloads feitos pela interface sao salvos normalmente pelo navegador no
computador do usuario; o contêiner nao precisa armazenar esses arquivos.

> A aplicacao nao possui autenticacao. A configuracao fornecida publica somente
> a porta local. Nao exponha esse contêiner diretamente na internet. Para uso
> remoto, adicione proxy reverso, HTTPS, autenticacao e limites de requisicao.

### Portabilidade e escala

A imagem resolve a instalacao do ambiente e permite reproduzir a aplicacao em
outras maquinas. Ela nao transforma automaticamente o servidor em um servico
multiusuario: a renderizacao OpenSCAD e intensiva e cada instancia possui CPU,
memoria e limite de tempo proprios. Para uma implantacao publica, a evolucao
recomendada e separar a API web dos workers de renderizacao, usar uma fila de
jobs, limitar concorrencia e executar varias replicas dos workers.

## Uso da interface

### Converter um insert STL

1. Abra a interface pelo servidor local.
2. Arraste um ou mais `.stl` para a area de entrada.
3. Confira `BOX_SIZE_XYZ` e os compartimentos detectados.
4. Revise parede, fundo, folga, escala, formato, tampa e recortes.
5. Ajuste cada linha em **Compartimentos detectados**, se necessario.
6. Confira o painel **OpenSCAD gerado**.
7. Baixe o pacote combinado ou os pacotes individuais.
8. Use **Gerar STL** para renderizar o SCAD selecionado.

O ZIP inclui o `.scad` e `boardgame_insert_toolkit_lib.4.scad` no caminho
esperado pelo `include`.

### Criar um insert com pecas 3MF

1. Preencha largura, profundidade e altura internas da caixa.
2. Defina a folga externa desejada.
3. Clique em **Importar pecas 3MF**.
4. Revise nome, quantidade, orientacao e dimensoes das pecas.
5. Adicione manualmente componentes ausentes, se necessario.
6. Clique em **Criar insert**.
7. Ajuste as cavidades planejadas individualmente.
8. Baixe o pacote SCAD ou gere o STL.

**Baixar STL das pecas** exporta as geometrias originais do 3MF. Essa operacao
e separada da criacao do insert.

### Verificar fidelidade

Selecione um modelo individual e clique em **Verificar fidelidade**. O servidor:

1. renderiza o SCAD atual para STL;
2. alinha os centros das caixas delimitadoras, sem alterar a escala;
3. mede distancias de superficie nas duas direcoes;
4. mostra F-score, erro medio, P95 e uma imagem comparativa.

Vermelho representa o original e azul a reconstrucao. A verificacao se aplica a
inserts reconstruidos de STL, nao a projetos criados apenas de pecas 3MF.

### Abrir somente o HTML

Abrir `stl-to-bgsd-gui.html` diretamente permite analisar STL e gerar pacotes
SCAD, mas deixa indisponiveis:

- importacao e exportacao 3MF;
- planejamento pelo backend;
- renderizacao SCAD para STL;
- verificacao automatica de fidelidade.

## Linha de comando

Conversao basica:

```powershell
node .\stl-to-bgsd.js .\modelo.stl
```

Todos os STL e um SCAD combinado:

```powershell
node .\stl-to-bgsd.js --combined .\my_designs\all-inserts.scad ".\*.stl"
```

Exemplos:

```powershell
node .\stl-to-bgsd.js --clearance 0.5 --wall 2 --bottom 2 ".\*.stl"
node .\stl-to-bgsd.js --with-lid --lid-label "Cartas" .\cartas.stl
node .\stl-to-bgsd.js --box-label "Tokens" --feature-labels .\tokens.stl
node .\stl-to-bgsd.js --cutouts alternate-lr --cutout-width 60 .\bandeja.stl
node .\stl-to-bgsd.js --validate-fidelity --fidelity-tolerance 0.5 .\modelo.stl
node .\stl-to-bgsd.js --no-infer-geometry .\modelo.stl
```

| Opcao | Funcao |
| --- | --- |
| `--out <pasta>` | Pasta de saida; padrao: `my_designs`. |
| `--combined <arquivo>` | Gera um SCAD com todos os modelos. |
| `--clearance <mm>` | Acrescenta folga as cavidades. |
| `--wall <mm>` | Espessura inicial das paredes. |
| `--bottom <mm>` | Espessura inicial do fundo. |
| `--height-extra <mm>` | Altura adicional das cavidades. |
| `--scale <fator>` | Escala as coordenadas antes da medicao. |
| `--no-detect-components` | Desativa deteccao de divisorias. |
| `--no-infer-geometry` | Desativa formas e aberturas automaticas. |
| `--with-lid` | Gera a caixa com tampa. |
| `--no-feature` | Gera somente a caixa. |
| `--bit-config <json>` | Aplica configuracao completa da BIT. |
| `--validate-fidelity` | Renderiza e compara cada reconstrucao. |
| `--openscad <arquivo>` | Indica o executavel OpenSCAD. |
| `--help` | Lista todas as opcoes. |

No Windows, `converter-stl-bgsd.cmd` e `STL-to-BGSD.exe` convertem todos os STL
da raiz para `my_designs`.

## Configuracao completa da BIT

O emissor orientado por schema contempla os 112 parametros publicos da BIT
4.12.0. Caracteristicas sem evidencia na malha podem ser fornecidas por JSON:

```powershell
node .\stl-to-bgsd.js `
  --bit-config .\bit-config.example.json `
  --combined .\my_designs\all-inserts.scad `
  ".\*.stl"
```

[bit-config.example.json](bit-config.example.json) demonstra objetos, features,
tampa, labels, grupos, copias, SVG, divisores e visualizacao. Chaves desconhecidas
ou usadas no contexto errado interrompem a conversao com um erro de validacao.

Auditoria da cobertura:

```powershell
node .\tools\bit-coverage.js --check
```

## Saidas

Por padrao, a CLI grava em `my_designs`:

```text
my_designs/
  modelo.scad
  all-inserts.scad
lib/
  boardgame_insert_toolkit_lib.4.scad
```

Os SCAD normalmente usam:

```openscad
include <../lib/boardgame_insert_toolkit_lib.4.scad>;
```

Ao mover um SCAD, preserve a relacao entre `my_designs` e `lib` ou ajuste o
`include`. Os ZIP da interface ja colocam a biblioteca junto do design.

Com fidelidade habilitada tambem sao gerados:

- `<nome>.fidelity.json`: metricas, dimensoes e diagnosticos;
- `<nome>.fidelity.png`: original, reconstrucao e sobreposicao.

## Testes

```powershell
node --test tests/*.test.js
```

A suite cobre conversao STL, fundos em alturas diferentes, ida e volta SCAD/STL,
BIT, fidelidade, importacao 3MF, planejamento e pacotes da interface. Testes de
renderizacao exigem OpenSCAD e podem demorar.

## Gerar os inicializadores Windows

```powershell
.\build-exe.ps1
```

O script compila `STL-to-BGSD.exe` e `STL-to-BGSD-GUI.exe` a partir de
`launcher/`.

## Estrutura

```text
stl-to-bgsd.js                 Conversor principal
stl-to-bgsd-gui.html           Interface web
tools/gui-server.js            Servidor local e API de renderizacao
tools/game-insert.js           Importador 3MF e planejador
tools/stl-fidelity.js          Analise geometrica
tools/validate-fidelity.js     Comparacao STL x SCAD
tools/bit-coverage.js          Auditoria da BIT
lib/                           Biblioteca BIT e versao embutida
tests/                         Testes automatizados
launcher/                      Inicializadores Windows
BGSD-src/                      Fontes auxiliares do BGSD
my_designs/                    Saidas locais de exemplo
```

## Variaveis de ambiente

| Variavel | Uso |
| --- | --- |
| `OPENSCAD_PATH` | Caminho do OpenSCAD. |
| `STL_BGSD_GUI_HOST` | Interface de rede; padrao local: `127.0.0.1`. |
| `STL_BGSD_GUI_PORT` | Porta do servidor; padrao: `43721`. |
| `STL_BGSD_RENDER_TIMEOUT_MS` | Limite de render; padrao: `600000` ms. |

Exemplo para 20 minutos:

```powershell
$env:STL_BGSD_RENDER_TIMEOUT_MS = 1200000
node .\tools\gui-server.js --open
```

## Solucao de problemas

### Gerar STL falha ou retorna HTTP 405

Abra a interface em `http://127.0.0.1:43721/`. Um servidor estatico, como Live
Server, entrega o HTML, mas nao implementa `POST /api/render-stl`.

### OpenSCAD nao encontrado

Instale o OpenSCAD ou configure `OPENSCAD_PATH`, depois reinicie o servidor.

### A renderizacao excede dez minutos

Tampas vazadas e detalhes complexos podem ser lentos. Selecione `BOX` em
**Saida BIT**, simplifique o modelo ou aumente `STL_BGSD_RENDER_TIMEOUT_MS`.

### O SCAD abre sem a biblioteca

Use o ZIP da interface ou mantenha a biblioteca no caminho do `include`. Um
`.scad` isolado nao incorpora automaticamente a BIT.

### A reconstrucao nao ficou igual ao STL

Revise escala, orientacao, paredes, fundo, dimensoes individuais, recortes e
contornos curvos ou decorativos. Use **Verificar fidelidade** antes de imprimir.

### Uma cavidade ficou com profundidade errada

A deteccao exige uma superficie horizontal suficientemente grande. Corrija o Z
em **Compartimentos detectados** quando o fundo for curvo, vazado, texturizado
ou parcialmente obstruido.

## Limitacoes conhecidas

- STL nao preserva nomes, parametros, booleanas ou intencao CAD.
- Pisos curvos, inclinados, vazados ou texturizados podem nao ser medidos.
- Alturas irregulares no topo das paredes ainda nao sao reconstruidas livremente.
- Formas organicas e decoracoes nao viram parametros BIT equivalentes.
- BIT 4.12.0 usa `BOX_WALL_THICKNESS` para parede e fundo, podendo exigir
  aproximacao quando essas medidas sao diferentes no original.
- O planejador 3MF usa caixas delimitadoras, nao encaixe de contorno.
- Fidelidade geometrica nao garante tolerancia da impressora ou imprimibilidade.
- Revise o resultado no BGSD/OpenSCAD e faca um teste antes da producao final.

## Privacidade

Fora do Docker, o servidor escuta somente em `127.0.0.1` por padrao. No Compose,
ele escuta `0.0.0.0` dentro do contêiner, mas a porta e vinculada a
`127.0.0.1` no computador hospedeiro. STL, 3MF e SCAD sao processados localmente
e nao sao enviados a servicos externos pelo codigo do projeto.

## Licencas

Antes de redistribuir o repositorio ou seus binarios, confira as licencas dos
componentes incluidos, especialmente BIT, BGSD e dependencias do `package.json`.
