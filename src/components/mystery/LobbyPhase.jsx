import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { MysteryPlayer, MysteryRoom } from '@/api/db';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Copy, Check, Users, Crown, ArrowRight, Pencil, ChevronDown, ChevronUp, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CATEGORIES, PACKS } from '@/lib/wordLists';
import { useLang } from '@/lib/LanguageContext';

export default function LobbyPhase({ room, players, me, roomCode }) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { t } = useLang();
  const [copied, setCopied] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [loading, setLoading] = useState(false);
  const [expandedPack, setExpandedPack] = useState(null);
  const isHost = room.host_id === me?.id;

  const leaveGame = async () => {
    try {
      const myPlayer = players.find(p => p.user_id === me?.id);
      if (myPlayer) await MysteryPlayer.delete(myPlayer.id);
      if (isHost) {
        const remaining = players.filter(p => p.user_id !== me?.id);
        if (remaining.length === 0) {
          await MysteryRoom.delete(room.id);
        } else {
          await MysteryRoom.update(room.id, {
            host_id: remaining[0].user_id,
            host_name: remaining[0].display_name
          });
        }
      }
      navigate('/');
    } catch(e) {
      navigate('/');
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const startGame = async () => {
    const cat = selectedCategory;
    if (!cat) { toast({ title: 'Pick a category first', variant: 'destructive' }); return; }
    if (players.length < 2) { toast({ title: 'Need at least 2 players', variant: 'destructive' }); return; }
    setLoading(true);
    try {
      await MysteryRoom.update(room.id, { status: 'word_entry', category: cat });
    } catch(e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-slate-950 via-violet-950 to-slate-950 text-white p-4 flex flex-col items-center"
      style={{
        paddingTop: 'max(env(safe-area-inset-top), 1rem)',
        paddingBottom: 'max(env(safe-area-inset-bottom), 1rem)',
      }}
    >
      <div className="w-full max-w-lg pt-4">
        <div className="flex items-center mb-6">
          <button onClick={() => navigate('/')} className="p-2 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition">
            <ArrowLeft className="w-5 h-5" />
          </button>
        </div>
        <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-1">What's my pick?</h1>
          <p className="text-slate-400">{t.waitingForPlayers}</p>
        </motion.div>

        {/* Room code */}
        <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.1 }}
          className="flex items-center justify-center gap-3 mb-8">
          <div className="px-6 py-3 rounded-2xl bg-white/5 ring-1 ring-white/10">
            <p className="text-xs text-slate-400 mb-0.5 text-center">{t.roomCode}</p>
            <p className="font-mono text-3xl font-bold tracking-widest text-violet-300">{roomCode}</p>
          </div>
          <button onClick={copyCode} className="p-3 rounded-xl bg-white/5 hover:bg-white/10 ring-1 ring-white/10 transition">
            {copied ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5 text-slate-400" />}
          </button>
        </motion.div>

        {/* Players */}
        <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.15 }}
          className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-violet-400" />
            <span className="text-sm font-medium text-slate-300">{players.length} / 12 players</span>
          </div>
          <div className="space-y-2">
            {players.map((p, i) => (
              <motion.div key={p.id} initial={{ opacity:0, x:-10 }} animate={{ opacity:1, x:0 }} transition={{ delay: i * 0.05 }}
                className="flex items-center gap-3 py-2 px-3 rounded-xl bg-white/5">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white"
                  style={{ backgroundColor: p.color }}>
                  {p.display_name[0].toUpperCase()}
                </div>
                <span className="flex-1 font-medium">{p.display_name}</span>
                {p.user_id === room.host_id && <Crown className="w-4 h-4 text-amber-400" />}
                {p.user_id === me?.id && <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/30 text-violet-300">YOU</span>}
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Start button — host only */}
        {isHost && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.18 }} className="mb-6">
            <Button onClick={startGame} disabled={loading || !selectedCategory}
              className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-violet-500 to-pink-600 hover:from-violet-600 hover:to-pink-700 border-0">
              <ArrowRight className="w-5 h-5 mr-2" />
              {loading ? t.starting : selectedCategory ? t.startWith(selectedCategory) : t.startGame}
            </Button>
          </motion.div>
        )}

        {/* Category selection — host only */}
        {isHost && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.2 }} className="mb-6">
            <p className="text-sm font-medium text-slate-300 mb-3">{t.selectCategory}</p>

            {/* Free categories */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              {CATEGORIES.map(cat => (
                <button key={cat} onClick={() => setSelectedCategory(cat)}
                  className={`py-3 px-3 rounded-xl text-sm font-medium transition ${selectedCategory === cat ? 'bg-violet-500 text-white' : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}>
                  {cat}
                </button>
              ))}
            </div>

            {/* Packs — all bundled categories, browsable by group */}
            <div className="space-y-3">
              {PACKS.map(pack => {
                const isExpanded = expandedPack === pack.id;
                return (
                  <div key={pack.id} className="rounded-2xl ring-1 ring-white/10 bg-white/5 overflow-hidden transition-all">
                    <button
                      onClick={() => setExpandedPack(isExpanded ? null : pack.id)}
                      className="w-full flex items-center gap-3 p-4"
                    >
                      <span className="text-xl">{pack.emoji}</span>
                      <div className="flex-1 text-left">
                        <p className="text-sm font-semibold text-white">{pack.name}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{pack.categories.join(' · ')}</p>
                      </div>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-4 grid grid-cols-2 gap-2">
                        {pack.categories.map(cat => (
                          <button key={cat} onClick={() => setSelectedCategory(cat)}
                            className={`py-2.5 px-3 rounded-xl text-sm font-medium transition
                              ${selectedCategory === cat ? 'bg-amber-500 text-white' : 'bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'}`}>
                            {cat}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Custom word category — players type their own secret word instead of picking one */}
            <div className="mt-3">
              <button onClick={() => setSelectedCategory('Custom')}
                className={`w-full py-3 px-3 rounded-xl text-sm font-medium transition flex items-center justify-center gap-1.5
                  ${selectedCategory === 'Custom' ? 'bg-violet-500 text-white' : 'bg-violet-500/10 text-violet-300 hover:bg-violet-500/20'}`}>
                <Pencil className="w-3.5 h-3.5" /> {t.custom}
              </button>
            </div>
          </motion.div>
        )}

        {!isHost && (
          <p className="text-center text-slate-400 text-sm mb-6">{t.waitingForHost}</p>
        )}
      </div>
    </div>
  );
}
