import { SignIn } from '@clerk/nextjs';
import { IconSpark } from '../../icons';

export default function Page() {
  return (
    <main className="center auth-bg">
      <div className="auth-brand"><span className="mark"><IconSpark /></span>Criador de Posts</div>
      <p className="auth-tag">Crie carrosséis e posts com a identidade da sua marca.</p>
      <SignIn />
    </main>
  );
}
