import { Loader2, Radio, Trash2 } from 'lucide-react';
import type { AnnouncementType, SystemAnnouncement } from '../../types/chat';

interface AdminAnnouncementsTabProps {
  t: (key: any) => string;
  announcements: SystemAnnouncement[];
  newAnnTitle: string;
  setNewAnnTitle: (val: string) => void;
  newAnnContent: string;
  setNewAnnContent: (val: string) => void;
  newAnnType: AnnouncementType;
  setNewAnnType: (val: AnnouncementType) => void;
  publishingAnn: boolean;
  onCreateAnnouncement: (e: React.FormEvent) => void;
  onToggleAnnouncement: (id: string, nextActive: boolean) => void;
  onDeleteAnnouncement: (id: string) => void;
}

export function AdminAnnouncementsTab({
  t,
  announcements,
  newAnnTitle,
  setNewAnnTitle,
  newAnnContent,
  setNewAnnContent,
  newAnnType,
  setNewAnnType,
  publishingAnn,
  onCreateAnnouncement,
  onToggleAnnouncement,
  onDeleteAnnouncement,
}: AdminAnnouncementsTabProps) {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <form
        onSubmit={onCreateAnnouncement}
        className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-4"
      >
        <div className="flex items-center gap-2 text-emerald-400">
          <Radio className="w-4 h-4" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-white">
            {t('createAnnouncementBtn')}
          </h4>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2 space-y-1">
            <label className="text-xs text-slate-300 font-semibold">{t('announcementTitleLabel')}</label>
            <input
              type="text"
              value={newAnnTitle}
              onChange={(e) => setNewAnnTitle(e.target.value)}
              placeholder={t('announcementTitlePlaceholder')}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-slate-300 font-semibold">{t('announcementTypeLabel')}</label>
            <select
              value={newAnnType}
              onChange={(e) => setNewAnnType(e.target.value as AnnouncementType)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="alert">Alert</option>
              <option value="update">Update</option>
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-slate-300 font-semibold">{t('announcementContentLabel')}</label>
          <textarea
            value={newAnnContent}
            onChange={(e) => setNewAnnContent(e.target.value)}
            placeholder={t('announcementContentPlaceholder')}
            rows={2}
            className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 resize-none"
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={publishingAnn || !newAnnTitle.trim() || !newAnnContent.trim()}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow transition cursor-pointer flex items-center gap-2"
          >
            {publishingAnn ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Radio className="w-3.5 h-3.5" />}
            <span>{t('publishAnnouncementBtn')}</span>
          </button>
        </div>
      </form>

      <div className="space-y-3">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          Existing Broadcasts ({announcements.length})
        </h4>

        {announcements.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-xs">{t('noAnnouncementsFound')}</div>
        ) : (
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl divide-y divide-slate-800/80 overflow-hidden">
            {announcements.map((ann) => (
              <div
                key={ann.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-[10px] font-bold uppercase ${
                        ann.type === 'alert'
                          ? 'text-red-400'
                          : ann.type === 'warning'
                          ? 'text-amber-400'
                          : ann.type === 'update'
                          ? 'text-sky-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      {ann.type}
                    </span>
                    <span className="text-xs font-bold text-white truncate">{ann.title}</span>
                    <span
                      className={`text-[10px] font-semibold ${
                        ann.active ? 'text-emerald-400' : 'text-slate-500'
                      }`}
                    >
                      · {ann.active ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{ann.content}</p>
                  <span className="text-[11px] text-slate-500 font-mono tabular-nums block">
                    {new Date(ann.createdAt).toLocaleString()} · {ann.authorName}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => onToggleAnnouncement(ann.id, !ann.active)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-800 transition cursor-pointer ${
                      ann.active
                        ? 'bg-slate-900 text-amber-300 hover:bg-slate-800'
                        : 'bg-slate-900 text-emerald-300 hover:bg-slate-800'
                    }`}
                  >
                    {ann.active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => onDeleteAnnouncement(ann.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition cursor-pointer"
                    title="Delete announcement"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
