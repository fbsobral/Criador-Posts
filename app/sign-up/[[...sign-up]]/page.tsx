import { SignUp } from '@clerk/nextjs';
import { IconSpark } from '../../icons';

/** Só conclui o cadastro de quem foi convidado (o link do convite traz um ticket). Com o cadastro "restrito" no Clerk, ninguém entra sem convite. */
export default function Page() {
  return (
    <main className="center auth-bg">
      <div className="auth-brand"><span className="mark"><IconSpark /></span>Criador de Posts</div>
      <p className="auth-tag">Você foi convidado. Crie sua senha para entrar.</p>
      <SignUp />
    </main>
  );
}
