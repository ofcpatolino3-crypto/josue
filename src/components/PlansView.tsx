import React, { useState } from 'react';
import { Check, Plus, Trash2, Copy, Sparkles, Star } from 'lucide-react';
import { Plan } from '../types';

interface PlansProps {
  plans: Plan[];
  onUpdatePlanPrice: (id: string, price: string) => void;
  onAddBenefit: (id: string, benefit: string) => void;
  onRemoveBenefit: (id: string, index: number) => void;
  onCopyPlan: (text: string) => void;
}

export const PlansView: React.FC<PlansProps> = ({
  plans,
  onUpdatePlanPrice,
  onAddBenefit,
  onRemoveBenefit,
  onCopyPlan,
}) => {
  const [newBenefits, setNewBenefits] = useState<Record<string, string>>({});
  const [copiedPlanId, setCopiedPlanId] = useState<string | null>(null);

  const handleBenefitInputChange = (planId: string, value: string) => {
    setNewBenefits((prev) => ({ ...prev, [planId]: value }));
  };

  const handleAddBenefitSubmit = (planId: string) => {
    const val = (newBenefits[planId] || '').trim();
    if (!val) return;
    onAddBenefit(planId, val);
    setNewBenefits((prev) => ({ ...prev, [planId]: '' }));
  };

  const handleCopyFormatted = (plan: Plan) => {
    const text =
      `*${plan.nome}*\n` +
      `💳 *Investimento:* ${plan.preco}\n\n` +
      `*O que está incluso:*\n` +
      plan.beneficios.map((b) => `✅ ${b}`).join('\n') +
      `\n\n📌 *Garantia incondicional de 7 dias e acesso imediato!*`;

    navigator.clipboard.writeText(text);
    setCopiedPlanId(plan.id);
    onCopyPlan(`Plano "${plan.nome}" copiado com formatação para o WhatsApp!`);
    setTimeout(() => setCopiedPlanId(null), 2000);
  };

  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <div className="mb-6">
        <div className="text-[11px] font-semibold tracking-[0.16em] uppercase text-[#C9A227] mb-1 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" />
          Portal Concurso
        </div>
        <h2 className="text-xl sm:text-2xl font-bold font-serif text-[#EDE6D6]">
          Assinaturas Premium
        </h2>
        <p className="text-xs sm:text-sm text-[#8C98B4] mt-0.5">
          Edite valores e benefícios e copie a proposta personalizada pronta para enviar no WhatsApp.
        </p>
      </div>

      {/* Grid of Plans */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5" id="plans-grid">
        {plans.map((plan) => {
          const isHighlight = plan.destaque || plan.id === 'premium2';
          const isCopied = copiedPlanId === plan.id;

          return (
            <div
              key={plan.id}
              className={`bg-[#172644] border rounded-xl p-5 sm:p-6 flex flex-col justify-between shadow-md transition-all duration-200 ${
                isHighlight
                  ? 'border-[#C9A227] shadow-[0_0_16px_rgba(201,162,39,0.1)]'
                  : 'border-[#2B3D63]'
              }`}
            >
              <div>
                {/* Plan Header */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h3 className="font-serif font-bold text-lg sm:text-xl text-[#EDE6D6]">
                    {plan.nome}
                  </h3>
                  {isHighlight && (
                    <span className="flex items-center gap-1 bg-[#C9A227]/15 text-[#C9A227] border border-[#C9A227]/40 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full">
                      <Star className="w-3 h-3 fill-current" />
                      Mais Completo
                    </span>
                  )}
                </div>

                {/* Price editor input */}
                <div className="mb-4">
                  <label className="block text-[10px] uppercase font-semibold text-[#8C98B4] tracking-wider mb-1">
                    Preço / Condições (editável)
                  </label>
                  <input
                    type="text"
                    defaultValue={plan.preco}
                    onBlur={(e) => onUpdatePlanPrice(plan.id, e.target.value.trim())}
                    className="w-full bg-[#101B2D] border border-dashed border-[#2B3D63] focus:border-[#C9A227] text-[#C9A227] font-serif font-semibold text-sm sm:text-base px-3 py-2 rounded-lg transition-colors"
                    title="Clique para editar a condição comercial"
                  />
                </div>

                {/* Benefits checklist */}
                <div className="mb-4">
                  <label className="block text-[10px] uppercase font-semibold text-[#8C98B4] tracking-wider mb-2">
                    Benefícios Inclusos ({plan.beneficios.length})
                  </label>
                  <ul className="space-y-2">
                    {plan.beneficios.map((benefit, index) => (
                      <li
                        key={index}
                        className="flex items-start justify-between gap-2.5 text-xs sm:text-[13px] text-[#EDE6D6] leading-relaxed group"
                      >
                        <div className="flex items-start gap-2 flex-1">
                          <Check className="w-4 h-4 text-[#C9A227] shrink-0 mt-0.5 stroke-[2.5]" />
                          <span>{benefit}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => onRemoveBenefit(plan.id, index)}
                          className="text-[#8C98B4] hover:text-[#B14432] opacity-50 group-hover:opacity-100 p-0.5 transition-opacity cursor-pointer shrink-0"
                          title="Remover benefício"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Add Benefit Row & Copy Button */}
              <div className="mt-3 pt-3 border-t border-[#2B3D63] space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newBenefits[plan.id] || ''}
                    onChange={(e) => handleBenefitInputChange(plan.id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddBenefitSubmit(plan.id);
                      }
                    }}
                    placeholder="Adicionar novo benefício..."
                    className="flex-1 bg-[#101B2D] border border-[#2B3D63] text-[#EDE6D6] placeholder-[#8C98B4]/60 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-[#C9A227]"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddBenefitSubmit(plan.id)}
                    className="bg-[#1F3057] hover:bg-[#2B3D63] text-[#EDE6D6] border border-[#2B3D63] px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[3]" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handleCopyFormatted(plan)}
                  className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-all shadow-sm cursor-pointer ${
                    isCopied
                      ? 'bg-[#6E8F5C] text-[#EDE6D6]'
                      : 'bg-[#C9A227] hover:bg-[#d8b030] active:scale-[0.99] text-[#101B2D]'
                  }`}
                >
                  {isCopied ? (
                    <>
                      <Check className="w-4 h-4 stroke-[3]" />
                      Plano Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copiar Proposta Formatada
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
