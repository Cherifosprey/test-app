import { Lock } from 'lucide-react';
import { MODULE_LABELS_FR } from '../config/erpConfig.js';

export default function PaywallOverlay({ module }) {
  const label = MODULE_LABELS_FR[module] || module;
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center p-8">
      <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center mb-4">
        <Lock size={28} className="text-gray-600 dark:text-gray-400" />
      </div>
      <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-2">
        Module {label} non activé
      </h2>
      <p className="text-sm text-gray-500 max-w-sm">
        Ce module n’est pas inclus dans l’offre actuelle de votre entreprise. Contactez votre administrateur pour l’activer.
      </p>
    </div>
  );
}
