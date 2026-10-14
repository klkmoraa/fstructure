import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ProposalGallery } from './ProposalGallery';
import '../design-system/fonts.css';
import '../design-system/tokens.css';
import '../design-system/components/ui.css';
import './proposals.css';

const root = document.getElementById('root');
if (!root) throw new Error('Falta la raíz de la galería.');
createRoot(root).render(<StrictMode><ProposalGallery /></StrictMode>);
