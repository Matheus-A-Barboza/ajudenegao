import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'Juntos pelo Negão • Rifa solidária',description:'Uma corrente de carinho para ajudar no tratamento e na recuperação do Negão.'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="pt-BR"><body>{children}</body></html>}
