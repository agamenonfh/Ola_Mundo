# Olá, Mundo
Primeiro repositório de curso do Git e GitHub.

Repositório público onde você, pequeno gafanhoto, pode ver se estou evoluindo bem ou não...

Segue ai!
---------------------------------------------------------------------------------------------------
Essa alteração foi direto pelo site.

## Aplicativo de ordens de serviço

O protótipo em [Site-exemplo](./Site-exemplo/) é um aplicativo web responsivo e instalável no Android (PWA). Ele permite registrar uma OS no local, guardar os dados e anexos no próprio aparelho e continuar usando a interface sem conexão após o primeiro acesso. A data segue `dd/MM/yyyy` e os horários usam o formato de 24 horas `HH:mm`; barras e dois-pontos aparecem automaticamente enquanto os números são digitados. Os campos do atendimento são obrigatórios; comentários, fotos e vídeos são opcionais.

### Versões e upload ao GitHub

O código executável fica em `Site-exemplo/`. Os relatórios de cada versão, com testes, alterações e screenshots anotadas, ficam em [versoes/](./versoes/). A versão documentada mais recente é [v1.0.1](./versoes/v1.0.1/). O [RELATORIO-C-SHARP.txt](./versoes/v1.0.1/RELATORIO-C-SHARP.txt) explica os componentes e mostra equivalentes didáticos em C#/.NET MAUI. Para enviar o projeto ao seu GitHub, inclua `README.md`, `Site-exemplo/` e `versoes/`; a lista detalhada de arquivos está em [ARQUIVOS.txt](./versoes/v1.0.1/ARQUIVOS.txt). Publique a raiz da branch com GitHub Pages e abra `/Site-exemplo/`.

### Executar e instalar

Sirva a pasta `Site-exemplo` por HTTPS (necessário para o modo offline e a instalação no Android). Para desenvolvimento, `http://localhost` também é aceito pelos navegadores. Abra o endereço no Chrome do Android e use **Instalar app** ou **Adicionar à tela inicial** no menu do navegador.

Os registros e anexos ficam no armazenamento local do navegador e não são enviados a um servidor deste projeto. Exporte cada OS pelo botão **Baixar TXT**; quando houver anexos, **Baixar ZIP** inclui o TXT da ordem e os arquivos originais. Os botões no histórico também permitem baixar todas as ordens em um único TXT ou todo o histórico e seus anexos em um ZIP. Exporte com frequência e mantenha cópias seguras: limpar os dados do navegador ou perder o aparelho pode apagar as ordens.

### Configurar Google Tasks (opcional)

A sincronização cria uma tarefa no Google Tasks com o resumo completo da OS. Para ativá-la:

1. Crie um projeto no Google Cloud, ative a **Google Tasks API** e configure a tela de consentimento OAuth.
2. Crie uma credencial OAuth 2.0 do tipo **Aplicativo da Web** e adicione a origem HTTPS desta aplicação em **Origens JavaScript autorizadas**.
3. Cole o ID de cliente público em `GOOGLE_CLIENT_ID`, no início de `Site-exemplo/app.js`, e publique a alteração.
4. No aplicativo, toque em **Conectar Google Tasks** e autorize o acesso solicitado.

Não coloque segredos OAuth no código. Sem configuração ou sem uma conta conectada, salvar continua funcionando localmente e as ordens podem ser exportadas como TXT/ZIP. A sincronização usa a lista de tarefas padrão da conta Google. Anexos permanecem apenas no aparelho e não são enviados para o Google Tasks.
