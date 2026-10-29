VERSOES DO APLICATIVO DE ORDENS DE SERVICO

Cada versao publicada ou testada deve ter uma pasta propria neste diretorio.
Nao sobrescreva uma versao anterior: crie uma nova pasta (por exemplo,
v1.0.1) e copie para ela todos os arquivos executaveis da pasta app/ atual.

ESTRUTURA DE CADA VERSAO

vX.Y.Z/
  screenshots/         Capturas reais do aplicativo com anotacoes visuais.
  LEIA-ME.txt          Como publicar esta versao no GitHub Pages.
  TESTES.txt           O que foi testado e o resultado.
  ALTERACOES.txt       O que mudou nesta versao.

O codigo executavel fica em Site-exemplo/. Envie essa pasta junto com
versoes/ para o GitHub. Os arquivos de cada versao documentam e comprovam
o estado testado, mas nao sao uma copia alternativa do codigo executavel.
Essa organizacao evita que duas copias do app fiquem diferentes sem querer.

Versoes documentadas: v1.0.0 e v1.0.1.
