# Cobertura STL para BGSD/BIT

Fonte de verdade: `lib/boardgame_insert_toolkit_lib.4.scad`, versao 4.12.0. O schema
`BGSD-src/schema/bit.schema.json` cobre os 112 parametros publicos encontrados na
biblioteca. Os outros dez identificadores publicos sao os tres tipos de objeto e
sete valores enumerados, nao parametros.

## Estado da cobertura

| Camada | Cobertura | Significado |
| --- | ---: | --- |
| Emissao SCAD orientada pelo schema | 112/112 | Qualquer parametro BIT pode ser serializado no contexto correto por `--bit-config`. |
| Validacao de contexto | 112/112 | Chaves desconhecidas ou usadas no objeto errado interrompem a conversao com a localizacao do erro. |
| Inferencia automatica do STL | parcial | Dimensoes externas, fundo, paredes, compartimentos, perfis SQUARE/ROUND/FILLET e recortes laterais com percentuais aproximados. |
| Confirmacao/configuracao humana | necessaria | Semantica de tampa, labels, grupos, copias, divisores, SVG, print groups e detalhes que a malha nao identifica com confianca. |

## Contextos contemplados pelo emissor

| Contexto BIT | Uso |
| --- | --- |
| globals | Selecao de saida, visualizacao, tolerancias, defaults e detents. |
| element | `OBJECT_BOX` e `OBJECT_SPACER`, incluindo tampa, features, grupos, copias e visualizacao. |
| feature | Formas, margens, padding, cutouts, shear, pedestal, filhos e divisores internos. |
| shape_svg | Cavidades com contorno SVG e clearance. |
| group / copy | Agrupamento, repeticao, posicao e rotacao. |
| feature_divider | Divisores gerados dentro de uma cavidade e seus trilhos. |
| lid | Cap, inset, sliding, detents, tabs, padroes, cutouts e labels. |
| label | Texto/imagem, fonte, escala, posicao, rotacao e profundidade. |
| visualization | Posicao e rotacao no modo montado. |
| divider | `OBJECT_DIVIDERS` independente. |

## Regra de fidelidade

"Suportado" nao significa "inferido". STL armazena triangulos, nao o historico do
projeto. A conversao automatica so deve afirmar uma caracteristica quando houver
evidencia geometrica suficiente. As demais caracteristicas entram pelo arquivo de
configuracao validado e, numa proxima etapa, pelo assistente visual de confirmacao.

A inferencia geometrica usa tres niveis de confianca. Resultados `high` e
`medium` podem alimentar o SCAD; resultados `low` nao alteram o modelo. O arquivo
gerado registra as decisoes em comentarios para facilitar a revisao no BGSD.

A espessura real do fundo e medida separadamente, mas BIT 4.12.0 aplica
`BOX_WALL_THICKNESS` tanto nas laterais quanto no fundo. O gerador registra a
medida original e limita a cavidade pela espessura uniforme da BIT para produzir
um modelo fisicamente valido.

## Validacao de fidelidade

`tools/validate-fidelity.js` fecha o ciclo STL -> BGSD -> STL. A comparacao usa
distancia ponto-triangulo bidirecional acelerada por uma hierarquia espacial,
sem redimensionar os modelos. O F-score combina cobertura do original e precisao
da reconstrucao dentro da tolerancia escolhida. Area, volume e estanqueidade sao
diagnosticos auxiliares; volume recebe uma ressalva quando a malha possui arestas
abertas ou nao manifold.

## Perfis externos

Degraus ortogonais confirmados pelas duas faces externas do mesmo canto sao
preservados como recortes OpenSCAD ao redor de `Make(data)`. Esse complemento
hibrido mantem o array BIT editavel e cobre contornos que `OBJECT_BOX`, por ser
retangular, nao consegue representar sozinho.
Uma extensao de cavidade localizada preserva a parede ao redor do degrau; isso
evita que uma cavidade retangular atravesse a face que deveria continuar solida.

Use o exemplo completo como ponto de partida:

```powershell
node .\stl-to-bgsd.js --bit-config .\bit-config.example.json --combined .\my_designs\all-inserts.scad .\*.stl
```

Em `objects`, a chave pode ser o nome do STL com ou sem extensao. Propriedades
simples complementam a deteccao. Objetos aninhados sao mesclados; listas como
`BOX_FEATURE` substituem a lista inferida, para que a ordem e as referencias BIT
continuem deterministicas. `elements` adiciona objetos independentes, como
`OBJECT_DIVIDERS`.
