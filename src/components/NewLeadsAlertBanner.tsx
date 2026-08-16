import React, { useState, useEffect } from 'react';
import {
  BellRing,
  Zap,
  CheckCheck,
  Volume2,
  VolumeX,
  Sparkles,
  Flame,
  ArrowRight,
  ShieldAlert,
  X,
  Target,
} from 'lucide-react';
import { Contact } from '../types';

interface NewLeadsAlertBannerProps {
  newLeads: Contact[];
  onStartImmediateQueue: () => void;
  onDismissAll: () => void;
  onSelectLead?: (contact: Contact) => void;
}

export const playNewLeadChime = () => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    
    // Play an energetic, positive 3-tone chime (F#5 -> A5 -> D6)
    const now = ctx.currentTime;
    
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc1.type = 'triangle';
    osc2.type = 'sine';

    // F#5 (739.99Hz) -> A5 (880Hz) -> D6 (1174.66Hz)
    osc1.frequency.setValueAtTime(740, now);
    osc1.frequency.setValueAtTime(880, now + 0.12);
    osc1.frequency.setValueAtTime(1175, now + 0.24);

    osc2.frequency.setValueAtTime(370, now);
    osc2.frequency.setValueAtTime(440, now + 0.12);
    osc2.frequency.setValueAtTime(587.5, now + 0.24);

    gainNode.gain.setValueAtTime(0.01, now);
    gainNode.gain.linearRampToValueAtTime(0.18, now + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.6);
    osc2.stop(now + 0.6);
  } catch (e) {
    // Sound might fail if user hasn't clicked page yet (browser autoplay policy)
  }
};

export const NewLeadsAlertBanner: React.FC<NewLeadsAlertBannerProps> = ({
  newLeads,
  onStartImmediateQueue,
  onDismissAll,
  onSelectLead,
}) => {
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    return localStorage.getItem('portal_leads_sound_alert') !== 'disabled';
  });

  const [isDismissedTemporarily, setIsDismissedTemporarily] = useState(false);

  // Group new leads by course to give instant visual summary
  const courseCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    newLeads.forEach((c) => {
      const course = c.curso?.trim() || 'Concurso Geral';
      counts[course] = (counts[course] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [newLeads]);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem('portal_leads_sound_alert', next ? 'enabled' : 'disabled');
    if (next) {
      playNewLeadChime();
    }
  };

  if (newLeads.length === 0 || isDismissedTemporarily) {
    return null;
  }

  return (
    <div
      id="new-leads-alert-banner"
      className="relative overflow-hidden rounded-xl bg-gradient-to-r from-[#16294A] via-[#1A3464] to-[#122240] border-2 border-[#C9A227] p-3.5 sm:p-4 shadow-xl text-[#EDE6D6] animate-bounce-subtle"
    >
      {/* Background visual elements */}
      <div className="absolute -right-8 -bottom-8 w-36 h-36 bg-[#C9A227]/10 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute -left-8 -top-8 w-36 h-36 bg-[#2563EB]/10 rounded-full blur-2xl pointer-events-none" />

      <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-3.5">
        {/* Left Side: Alert Badge & Lead Count Info */}
        <div className="flex items-start gap-3">
          <div className="relative shrink-0 mt-0.5">
            <div className="w-10 h-10 rounded-xl bg-[#C9A227] text-[#101B2D] flex items-center justify-center font-bold shadow-lg shadow-[#C9A227]/30 animate-pulse">
              <BellRing className="w-5 h-5 text-[#101B2D]" />
            </div>
            <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 text-[9px] text-white font-extrabold items-center justify-center">
                {newLeads.length > 99 ? '99+' : newLeads.length}
              </span>
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-black uppercase tracking-wider bg-[#C9A227]/20 text-[#C9A227] px-2 py-0.5 rounded border border-[#C9A227]/40 flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-[#F59E0B]" />
                Novos Leads na Sua Fila
              </span>

              <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Conversão até 4x maior nos primeiros 5 minutos
              </span>
            </div>

            <h3 className="text-base sm:text-lg font-bold text-white mt-1">
              Você recebeu <span className="text-[#C9A227] font-extrabold">{newLeads.length} novos contatos</span> para atender!
            </h3>

            {/* Courses chips */}
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span className="text-[11px] text-[#8C98B4]">Concursos:</span>
              {courseCounts.slice(0, 4).map(([course, count]) => (
                <span
                  key={course}
                  className="bg-[#101B2D] border border-[#2B3D63] text-[11px] text-[#EDE6D6] px-2 py-0.5 rounded-md font-medium flex items-center gap-1"
                >
                  <Target className="w-3 h-3 text-[#C9A227]" />
                  <span className="truncate max-w-[130px]">{course}</span>
                  <span className="text-[#C9A227] font-bold">({count})</span>
                </span>
              ))}
              {courseCounts.length > 4 && (
                <span className="text-[10px] text-[#8C98B4] font-semibold">
                  +{courseCounts.length - 4} outros
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Fast Actions */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end shrink-0 flex-wrap">
          {/* Audio toggle button */}
          <button
            type="button"
            onClick={toggleSound}
            className={`p-2 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
              soundEnabled
                ? 'bg-[#101B2D] border-[#2B3D63] text-[#C9A227] hover:border-[#C9A227]'
                : 'bg-[#101B2D] border-[#2B3D63] text-[#8C98B4] hover:text-white'
            }`}
            title={soundEnabled ? 'Avisos sonoros ativados (Clique para silenciar)' : 'Avisos sonoros desativados (Clique para ativar)'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Mark all as seen button */}
          <button
            type="button"
            onClick={onDismissAll}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#101B2D]/80 hover:bg-[#101B2D] text-[#8C98B4] hover:text-white text-xs font-semibold border border-[#2B3D63] transition-all cursor-pointer"
            title="Marcar todos os novos leads como vistos e limpar o alerta"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            <span>Marcar Vistos</span>
          </button>

          {/* Start immediate queue button */}
          <button
            type="button"
            onClick={onStartImmediateQueue}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-[#C9A227] hover:bg-[#d8b030] text-[#101B2D] font-extrabold px-4 py-2 rounded-lg text-xs sm:text-sm transition-all shadow-md active:scale-95 cursor-pointer"
          >
            <Zap className="w-4 h-4 fill-current" />
            <span>Atender Novos Leads Agora</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
