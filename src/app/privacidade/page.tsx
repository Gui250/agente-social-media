import type { Metadata } from "next";
import Link from "next/link";

// Fill in before publishing: who is responsible for the data (LGPD "controlador") and how users
// reach them. Meta also shows this page to users during the Facebook/Instagram login.
const RESPONSAVEL = {
  nome: "[NOME DA EMPRESA OU RESPONSÁVEL]",
  documento: "[CNPJ ou CPF]",
  email: "[E-MAIL DE CONTATO]",
};
const ATUALIZADA_EM = "29 de outubro de 2026";

export const metadata: Metadata = {
  title: "Política de Privacidade · Agente de Social Media",
  description: "Como o Agente de Social Media coleta, usa e protege seus dados.",
};

export default function PrivacidadePage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <article className="grid gap-6 text-sm leading-relaxed [&_h2]:mt-2 [&_h2]:text-base [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_ul]:grid [&_ul]:gap-1">
        <header className="grid gap-1">
          <h1 className="text-2xl font-semibold">Política de Privacidade</h1>
          <p className="text-muted-foreground">Última atualização: {ATUALIZADA_EM}</p>
        </header>

        <p>
          Esta política explica como o <strong>Agente de Social Media</strong> (“nós”, “o serviço”)
          trata os dados pessoais de quem o usa, em conformidade com a Lei Geral de Proteção de Dados
          (Lei nº 13.709/2018, “LGPD”). O serviço cria roteiros de criativo com inteligência
          artificial e agenda e publica posts nas contas do Instagram que você conecta.
        </p>

        <section className="grid gap-2">
          <h2>1. Quem é o responsável pelos dados</h2>
          <p>
            {RESPONSAVEL.nome}, {RESPONSAVEL.documento}. Contato para qualquer assunto de
            privacidade, inclusive o encarregado de dados: <a className="underline" href={`mailto:${RESPONSAVEL.email}`}>{RESPONSAVEL.email}</a>.
          </p>
        </section>

        <section className="grid gap-2">
          <h2>2. Quais dados coletamos</h2>
          <ul>
            <li>
              <strong>Conta:</strong> seu e-mail, sua senha (guardada apenas de forma cifrada, sem
              acesso ao texto original) e o fuso horário do seu navegador.
            </li>
            <li>
              <strong>Contas do Instagram e do Facebook que você conecta:</strong> identificador e
              nome de usuário da conta profissional do Instagram, identificador da Página do Facebook
              vinculada (quando você conecta pelo Facebook) e os tokens de acesso emitidos pela Meta.
              Não acessamos sua senha do Instagram ou do Facebook.
            </li>
            <li>
              <strong>Conteúdo que você cria no serviço:</strong> segmento do negócio e demais
              informações que você informa para gerar roteiros, os roteiros gerados, legendas, imagens
              e vídeos que você envia, datas de agendamento e o resultado de cada publicação (link do
              post ou motivo da falha).
            </li>
            <li>
              <strong>Conversas com o agente:</strong> as mensagens que você envia no chat e as
              respostas, guardadas para que o agente mantenha o contexto da conversa.
            </li>
            <li>
              <strong>Cookies essenciais:</strong> cookie de sessão, para manter você conectado, e um
              cookie temporário (10 minutos) que protege o processo de conexão com o
              Instagram/Facebook. Não usamos cookies de publicidade ou de rastreamento.
            </li>
          </ul>
        </section>

        <section className="grid gap-2">
          <h2>3. Para que usamos os dados</h2>
          <ul>
            <li>Criar sua conta, autenticar seu acesso e manter suas preferências (como o fuso horário).</li>
            <li>Gerar roteiros de criativo e responder às suas mensagens no chat.</li>
            <li>
              Agendar e publicar posts nas contas do Instagram que você conectou.{" "}
              <strong>Só publicamos depois que você confirma</strong> cada agendamento ou publicação.
            </li>
            <li>Mostrar o status dos seus posts e avisar quando uma publicação falha.</li>
            <li>Manter a segurança do serviço e corrigir erros.</li>
          </ul>
          <p>
            A base legal é a execução do contrato de uso do serviço (art. 7º, V, da LGPD) e, para a
            conexão com Instagram/Facebook, o seu consentimento, que você dá ao autorizar o acesso e
            pode retirar a qualquer momento desconectando a conta.
          </p>
          <p>
            Não vendemos seus dados, não os usamos para publicidade e não acessamos seguidores,
            mensagens diretas ou comentários das suas contas.
          </p>
        </section>

        <section className="grid gap-2">
          <h2>4. Com quem compartilhamos</h2>
          <p>Somente com os fornecedores necessários para o serviço funcionar:</p>
          <ul>
            <li>
              <strong>OpenAI</strong> (Estados Unidos): recebe suas mensagens do chat e as informações
              para gerar roteiros, e devolve as respostas. Os registros técnicos dessas execuções
              (rastreamento) também ficam na OpenAI. A OpenAI informa que dados enviados pela sua API
              não são usados para treinar modelos por padrão.
            </li>
            <li>
              <strong>Meta</strong> (Instagram e Facebook): recebe a legenda e a mídia de cada post que
              você confirma, para publicá-lo na conta escolhida.
            </li>
            <li>
              <strong>Supabase</strong>: hospeda o banco de dados, a autenticação e os arquivos de
              mídia.
            </li>
            <li>
              <strong>Provedor de hospedagem do site</strong>: executa a aplicação.
            </li>
          </ul>
          <p>
            Alguns desses fornecedores processam dados fora do Brasil. Nesses casos, a transferência
            internacional segue o art. 33 da LGPD, com base nas garantias contratuais desses
            fornecedores. Também podemos compartilhar dados quando a lei ou uma autoridade exigir.
          </p>
        </section>

        <section className="grid gap-2">
          <h2>5. Dados recebidos da Meta</h2>
          <p>
            Os dados obtidos pelas APIs do Instagram e do Facebook são usados apenas para identificar
            as contas que você conectou e publicar os posts que você confirmou. Os tokens de acesso
            ficam somente no nosso servidor, nunca são enviados ao seu navegador e são apagados quando
            você desconecta a conta.
          </p>
        </section>

        <section className="grid gap-2">
          <h2>6. Por quanto tempo guardamos</h2>
          <p>
            Enquanto sua conta estiver ativa. Os tokens de uma conta do Instagram são apagados assim
            que você a desconecta. Quando você pede a exclusão da conta, apagamos seus dados em até
            30 dias, exceto o que a lei nos obrigar a guardar.
          </p>
        </section>

        <section className="grid gap-2">
          <h2>7. Segurança</h2>
          <p>
            A comunicação é feita por conexão cifrada (HTTPS). Cada usuário só acessa os próprios
            dados, por regras aplicadas no próprio banco de dados, e os arquivos de mídia ficam em
            armazenamento privado: a Meta recebe apenas um link temporário, válido por uma hora, no
            momento da publicação. Nenhum sistema é totalmente imune a falhas; se ocorrer um incidente
            que possa trazer risco a você, avisaremos você e a ANPD, como manda a LGPD.
          </p>
        </section>

        <section className="grid gap-2">
          <h2>8. Seus direitos</h2>
          <p>
            Você pode, a qualquer momento: confirmar se tratamos seus dados; acessá-los; corrigi-los;
            pedir anonimização, bloqueio ou exclusão; pedir a portabilidade; saber com quem os
            compartilhamos; e retirar seu consentimento. Para isso, escreva para{" "}
            <a className="underline" href={`mailto:${RESPONSAVEL.email}`}>{RESPONSAVEL.email}</a>.
            Respondemos em até 15 dias. Você também pode reclamar à Autoridade Nacional de Proteção de
            Dados (ANPD).
          </p>
        </section>

        <section id="exclusao" className="grid gap-2 scroll-mt-4">
          <h2>9. Como excluir seus dados</h2>
          <ul>
            <li>
              <strong>Desconectar uma conta do Instagram/Facebook:</strong> no serviço, abra{" "}
              <Link className="underline" href="/contas">Contas</Link> e clique em “Desconectar”. O
              token de acesso é apagado na hora e os posts agendados para essa conta não são publicados.
            </li>
            <li>
              <strong>Remover o acesso pelo lado da Meta:</strong> no Facebook, vá em Configurações →
              Integrações comerciais; no Instagram, em Configurações → Apps e sites. Remova o Agente de
              Social Media.
            </li>
            <li>
              <strong>Excluir sua conta e todos os seus dados</strong> (roteiros, posts, mídias,
              conversas e contas conectadas): envie um e-mail para{" "}
              <a className="underline" href={`mailto:${RESPONSAVEL.email}?subject=Exclus%C3%A3o%20de%20dados`}>{RESPONSAVEL.email}</a>{" "}
              com o assunto “Exclusão de dados”, a partir do e-mail cadastrado. Confirmamos a exclusão
              em até 30 dias.
            </li>
          </ul>
        </section>

        <section className="grid gap-2">
          <h2>10. Menores de idade</h2>
          <p>O serviço é destinado a maiores de 18 anos e a empresas. Não coletamos dados de crianças.</p>
        </section>

        <section className="grid gap-2">
          <h2>11. Alterações</h2>
          <p>
            Podemos atualizar esta política. A data no topo mostra a última versão. Se a mudança for
            relevante, avisaremos pelo e-mail cadastrado antes de ela valer.
          </p>
        </section>

        <footer className="border-t pt-4 text-muted-foreground">
          <Link className="underline" href="/login">Voltar ao Agente de Social Media</Link>
        </footer>
      </article>
    </main>
  );
}
