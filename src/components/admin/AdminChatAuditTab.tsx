import { AlertOctagon, AlertTriangle, ArrowLeft, Eye, MessageSquare, Search, Trash2, Users, X } from 'lucide-react';
import type { ChatMessage, ChatRoom, UserProfile } from '../../types/chat';

interface AdminChatAuditTabProps {
  t: (key: any) => string;
  language: string;
  usersList: UserProfile[];
  allChats: ChatRoom[];
  filteredChats: ChatRoom[];
  selectedChat: ChatRoom | null;
  setSelectedChat: (chat: ChatRoom | null) => void;
  chatMessages: ChatMessage[];
  chatSearch: string;
  setChatSearch: (val: string) => void;
  chatFilter: 'all' | 'direct' | 'group';
  setChatFilter: (val: 'all' | 'direct' | 'group') => void;
  targetUserChatFilter: UserProfile | null;
  setTargetUserChatFilter: (u: UserProfile | null) => void;
  mobileChatView: 'list' | 'messages';
  setMobileChatView: (val: 'list' | 'messages') => void;
  onInspectUserChats: (u: UserProfile) => void;
  onEnterGhostMode?: (user: UserProfile, targetChatId?: string) => void;
  onOpenWarn: (u: UserProfile, defaultText: string) => void;
  onOpenBan: (u: UserProfile, defaultReason: string) => void;
  onDeleteMessage: (chatId: string, msgId: string) => void;
}

export function AdminChatAuditTab({
  t,
  language,
  usersList,
  allChats,
  filteredChats,
  selectedChat,
  setSelectedChat,
  chatMessages,
  chatSearch,
  setChatSearch,
  chatFilter,
  setChatFilter,
  targetUserChatFilter,
  setTargetUserChatFilter,
  mobileChatView,
  setMobileChatView,
  onInspectUserChats,
  onEnterGhostMode,
  onOpenWarn,
  onOpenBan,
  onDeleteMessage,
}: AdminChatAuditTabProps) {
  return (
    <div className="flex-1 min-h-0 w-full max-w-6xl mx-auto flex flex-col gap-3">
      {targetUserChatFilter && (
        <div className="bg-gradient-to-r from-sky-950/50 via-slate-950/70 to-slate-900/60 border border-sky-500/40 rounded-2xl p-3 px-4 flex items-center justify-between gap-3 shrink-0 shadow-sm animate-in fade-in">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              <img
                src={targetUserChatFilter.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${targetUserChatFilter.userId}`}
                alt={targetUserChatFilter.displayName}
                className="w-10 h-10 rounded-full object-cover border-2 border-sky-500/60 bg-slate-800 shadow"
              />
              {targetUserChatFilter.isOnline && (
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-950" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400 bg-sky-500/15 px-2 py-0.5 rounded-full border border-sky-500/30">
                  {t('viewingChatsForUser')}
                </span>
                <span className="text-xs sm:text-sm font-bold text-white truncate">
                  {targetUserChatFilter.displayName}
                </span>
              </div>
              <div className="text-[11px] text-slate-400 truncate mt-0.5">
                {targetUserChatFilter.email} · <span className="text-sky-300 font-semibold">{filteredChats.length}</span> {language === 'bn' ? 'টি চ্যাট পাওয়া গেছে' : 'conversations found'}
              </div>
            </div>
          </div>
          <button
            onClick={() => {
              setTargetUserChatFilter(null);
              if (allChats.length > 0) setSelectedChat(allChats[0]);
            }}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold cursor-pointer transition flex items-center gap-1.5 shrink-0 border border-slate-700 shadow-sm"
          >
            <X className="w-3.5 h-3.5 text-slate-400" />
            <span>{t('clearFilterBtn')}</span>
          </button>
        </div>
      )}

      <div className="flex-1 min-h-0 flex flex-col md:flex-row gap-3 sm:gap-4 overflow-hidden">
        {/* Left Column */}
        <div
          className={`w-full md:w-80 bg-slate-950/80 border border-slate-800 rounded-2xl p-3 flex-col shrink-0 min-h-0 space-y-3 ${
            mobileChatView === 'messages' ? 'hidden md:flex' : 'flex'
          }`}
        >
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-slate-400 flex items-center gap-1 uppercase tracking-wider">
              <Users className="w-3 h-3 text-sky-400" />
              <span>{t('filterByUserLabel')}</span>
            </label>
            <select
              value={targetUserChatFilter?.userId || ''}
              onChange={(e) => {
                const targetId = e.target.value;
                if (!targetId) {
                  setTargetUserChatFilter(null);
                  if (allChats.length > 0) setSelectedChat(allChats[0]);
                } else {
                  const found = usersList.find((u) => u.userId === targetId);
                  if (found) onInspectUserChats(found);
                }
              }}
              className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500 cursor-pointer"
            >
              <option value="">{t('allUsersOption')}</option>
              {usersList.map((u) => (
                <option key={u.userId} value={u.userId}>
                  {u.displayName} ({u.email || u.username || u.userId.slice(0, 6)})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
            <h4 className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
              {t('allPlatformChats')} ({filteredChats.length})
            </h4>
            <div className="flex gap-1">
              {(['all', 'direct', 'group'] as const).map((tag) => (
                <button
                  key={tag}
                  onClick={() => setChatFilter(tag)}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold transition cursor-pointer ${
                    chatFilter === tag ? 'bg-sky-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tag === 'all' ? 'All' : tag === 'direct' ? '1:1' : 'Group'}
                </button>
              ))}
            </div>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={chatSearch}
              onChange={(e) => setChatSearch(e.target.value)}
              placeholder={t('searchChatsAdminPlaceholder')}
              className="w-full pl-8 pr-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-0.5 scrollbar-thin">
            {filteredChats.length === 0 ? (
              targetUserChatFilter ? (
                <div className="py-8 px-4 text-center space-y-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-slate-900 border border-slate-800 text-slate-500 flex items-center justify-center mx-auto">
                    <MessageSquare className="w-5 h-5 text-sky-400" />
                  </div>
                  <p className="text-xs text-slate-400 font-medium leading-relaxed">
                    {t('noChatsForThisUser')}
                  </p>
                  <button
                    onClick={() => {
                      setTargetUserChatFilter(null);
                      if (allChats.length > 0) setSelectedChat(allChats[0]);
                    }}
                    className="px-3 py-1.5 bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 rounded-xl text-xs font-semibold cursor-pointer transition border border-sky-500/30 inline-block shadow-sm"
                  >
                    {t('clearFilterBtn')}
                  </button>
                </div>
              ) : (
                <div className="text-xs text-slate-500 text-center py-8">No chats found.</div>
              )
            ) : (
              filteredChats.map((c) => {
                const isSelected = selectedChat?.id === c.id;
                const isGroup = c.type === 'group';

                let partnerInfo: { displayName: string; photoURL?: string; email?: string } | undefined;
                if (!isGroup) {
                  if (targetUserChatFilter) {
                    const partnerId = c.participantIds?.find((id) => id !== targetUserChatFilter.userId);
                    partnerInfo = (partnerId && c.participantDetails?.[partnerId]) ||
                      Object.values(c.participantDetails || {}).find((p) => p.email !== targetUserChatFilter.email);
                  } else {
                    const details = Object.values(c.participantDetails || {});
                    partnerInfo = details[0];
                  }
                }

                let cardTitle = '';
                let cardSubtitle = '';
                if (isGroup) {
                  cardTitle = c.name || 'Group Conversation';
                  cardSubtitle = `Group · ${c.participantIds?.length || 0} members`;
                } else if (targetUserChatFilter) {
                  cardTitle = partnerInfo?.displayName
                    ? t('directChatWith').replace('{name}', partnerInfo.displayName)
                    : 'Direct Conversation';
                  cardSubtitle = partnerInfo?.email || '1:1 Direct Chat';
                } else {
                  const pList = Object.values(c.participantDetails || {});
                  cardTitle = pList.length >= 2
                    ? `${pList[0]?.displayName} & ${pList[1]?.displayName}`
                    : pList[0]?.displayName || 'Direct Chat';
                  cardSubtitle = pList.map((p) => p.displayName).join(' · ');
                }

                return (
                  <div
                    key={c.id}
                    onClick={() => {
                      setSelectedChat(c);
                      setMobileChatView('messages');
                    }}
                    className={`p-2.5 rounded-xl border transition cursor-pointer select-none ${
                      isSelected
                        ? 'bg-sky-950/40 border-sky-500/80 text-white shadow-sm ring-1 ring-sky-500/30'
                        : 'bg-slate-900/60 border-slate-800/80 text-slate-300 hover:bg-slate-850 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="relative shrink-0 mt-0.5">
                        {isGroup ? (
                          <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center font-bold text-xs">
                            <Users className="w-4 h-4" />
                          </div>
                        ) : (
                          <img
                            src={partnerInfo?.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${partnerInfo?.displayName || c.id}`}
                            alt={cardTitle}
                            className="w-8 h-8 rounded-full object-cover bg-slate-800 border border-slate-700"
                          />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between text-xs font-bold gap-1">
                          <span className="truncate">{cardTitle}</span>
                          <span
                            className={`text-[9px] px-1.5 py-0.2 rounded-md font-semibold shrink-0 ${
                              isGroup
                                ? 'bg-indigo-500/20 text-indigo-300'
                                : 'bg-sky-500/20 text-sky-300'
                            }`}
                          >
                            {isGroup ? 'Group' : 'Direct'}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 truncate mt-0.5">
                          {cardSubtitle}
                        </div>
                        <div className="text-[11px] text-slate-300 truncate mt-1 font-normal">
                          {c.lastMessageText || <span className="text-slate-500 italic">No messages</span>}
                        </div>
                        <div className="text-[9px] text-slate-500 mt-1">
                          {c.updatedAt ? new Date(c.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column */}
        <div
          className={`flex-1 bg-slate-950/80 border border-slate-800 rounded-2xl flex-col min-h-0 overflow-hidden ${
            mobileChatView === 'list' ? 'hidden md:flex' : 'flex'
          }`}
        >
          {selectedChat ? (
            <>
              <div className="p-2.5 sm:p-3.5 bg-slate-900 border-b border-slate-800 flex flex-col gap-2 shrink-0">
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <button
                      onClick={() => setMobileChatView('list')}
                      className="md:hidden p-1.5 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 shrink-0 cursor-pointer transition flex items-center gap-1 text-xs font-semibold"
                      title={t('backToChatList')}
                    >
                      <ArrowLeft className="w-4 h-4 text-sky-400 shrink-0" />
                      <span className="hidden sm:inline">{t('backToChatList')}</span>
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <h3 className="text-xs sm:text-sm font-bold text-white truncate">
                          {selectedChat.type === 'group'
                            ? selectedChat.name
                            : (() => {
                                const pList = Object.values(selectedChat.participantDetails || {});
                                if (pList.length >= 2) {
                                  return `${pList[0].displayName} & ${pList[1].displayName}`;
                                }
                                return selectedChat.name || 'Direct Conversation';
                              })()}
                        </h3>
                        <span className="text-[9px] px-1.5 py-0.5 rounded font-mono font-bold bg-sky-950/80 text-sky-400 border border-sky-500/30 shrink-0">
                          {selectedChat.type === 'group' ? 'Group' : '1:1'}
                        </span>
                        <span className="hidden lg:inline-block text-[9px] px-1.5 py-0.5 rounded font-mono text-slate-400 bg-slate-950 border border-slate-800 shrink-0">
                          ID: {selectedChat.id.slice(0, 10)}...
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {onEnterGhostMode && (
                      <button
                        onClick={() => {
                          const target =
                            targetUserChatFilter ||
                            usersList.find((u) => selectedChat.participantIds?.includes(u.userId));
                          if (target) onEnterGhostMode(target, selectedChat.id);
                        }}
                        className="px-2.5 sm:px-3 py-1.5 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold cursor-pointer transition shadow flex items-center gap-1.5 shrink-0"
                        title={language === 'bn' ? 'আসল মেসেঞ্জারে এই চ্যাটে সরাসরি প্রবেশ করুন' : 'Open this exact chat in Live Messenger'}
                      >
                        <Eye className="w-3.5 h-3.5 shrink-0" />
                        <span className="hidden sm:inline">{t('openLiveDmBtn')}</span>
                        <span className="sm:hidden">{language === 'bn' ? 'লাইভ দেখুন' : 'Live DM'}</span>
                      </button>
                    )}
                    <span className="text-[11px] sm:text-xs font-semibold text-slate-400 bg-slate-950 px-2 sm:px-2.5 py-1.5 rounded-xl border border-slate-800 shrink-0 whitespace-nowrap">
                      {chatMessages.length} {language === 'bn' ? 'টি বার্তা' : 'msgs'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5 w-full">
                  {Object.values(selectedChat.participantDetails || {}).map((p, idx) => {
                    const isInspected = targetUserChatFilter && p.email === targetUserChatFilter.email;
                    return (
                      <span
                        key={idx}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium border shrink-0 whitespace-nowrap ${
                          isInspected
                            ? 'bg-sky-500/20 text-sky-300 border-sky-500/40 ring-1 ring-sky-500/20'
                            : 'bg-slate-850 text-slate-300 border-slate-700/80'
                        }`}
                        title={`${p.displayName} (${p.email || ''})`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                        <span className="font-semibold max-w-[120px] sm:max-w-[180px] truncate">{p.displayName}</span>
                        {p.email && (
                          <span className="text-slate-400 text-[9px] max-w-[120px] sm:max-w-[160px] truncate hidden sm:inline">
                            ({p.email})
                          </span>
                        )}
                        {isInspected && (
                          <span className="text-[8px] bg-sky-500 text-slate-950 font-bold px-1 rounded shrink-0">
                            TARGET
                          </span>
                        )}
                      </span>
                    );
                  })}
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 space-y-3 scrollbar-thin">
                {chatMessages.length === 0 ? (
                  <div className="text-xs text-slate-500 text-center py-16 space-y-2">
                    <MessageSquare className="w-8 h-8 text-slate-700 mx-auto" />
                    <p>{t('noMsgsInSelectedChat')}</p>
                  </div>
                ) : (
                  chatMessages.map((msg) => {
                    const isFromTarget = targetUserChatFilter && (
                      msg.senderId === targetUserChatFilter.userId ||
                      msg.senderName === targetUserChatFilter.displayName
                    );

                    const senderProfile = usersList.find(
                      (u) => u.userId === msg.senderId || u.displayName === msg.senderName
                    );

                    return (
                      <div
                        key={msg.id}
                        className={`p-3.5 rounded-2xl flex items-start justify-between gap-3 group transition border ${
                          isFromTarget
                            ? 'bg-slate-900 border-sky-500/40 shadow-sm'
                            : 'bg-slate-950/70 border-slate-800/80 hover:border-slate-700'
                        }`}
                      >
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-white truncate">
                              {msg.senderName}
                            </span>
                            {isFromTarget && (
                              <span className="px-1.5 py-0.2 rounded-md bg-sky-500/20 text-sky-300 text-[9px] font-bold border border-sky-500/30">
                                {language === 'bn' ? 'পর্যবেক্ষণকৃত ইউজার' : 'Target User'}
                              </span>
                            )}
                            <span className="text-[10px] text-slate-500">
                              {new Date(msg.createdAt).toLocaleTimeString()} · {new Date(msg.createdAt).toLocaleDateString()}
                            </span>
                          </div>

                          <p className="text-xs text-slate-200 whitespace-pre-wrap break-words leading-relaxed">
                            {msg.text}
                          </p>

                          {msg.mediaUrl && (
                            <div className="mt-2 max-w-sm rounded-xl overflow-hidden border border-slate-800 bg-slate-900/60 p-1">
                              {msg.type === 'image' ? (
                                <img
                                  src={msg.mediaUrl}
                                  alt="Attachment"
                                  className="max-h-52 w-full object-cover rounded-lg"
                                />
                              ) : msg.type === 'audio' ? (
                                <div className="p-2 space-y-1">
                                  <div className="text-[10px] font-semibold text-slate-400 flex items-center gap-1">
                                    <span>Voice Note Recording</span>
                                  </div>
                                  <audio controls src={msg.mediaUrl} className="w-full h-8" />
                                </div>
                              ) : (
                                <a
                                  href={msg.mediaUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs text-sky-400 underline p-2 block hover:text-sky-300"
                                >
                                  View File Attachment
                                </a>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 opacity-90 sm:opacity-40 group-hover:opacity-100 transition shrink-0">
                          {senderProfile && (
                            <>
                              <button
                                onClick={() => onOpenWarn(senderProfile, `Violation in chat ${selectedChat.id}: "${msg.text?.slice(0, 50)}..."`)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 cursor-pointer transition"
                                title={language === 'bn' ? 'এই বার্তা প্রেরককে সতর্ক করুন' : 'Warn sender'}
                              >
                                <AlertTriangle className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => onOpenBan(senderProfile, `Violation in chat ${selectedChat.id}: "${msg.text?.slice(0, 50)}..."`)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer transition"
                                title={language === 'bn' ? 'এই বার্তা প্রেরককে সাসপেন্ড করুন' : 'Suspend sender'}
                              >
                                <AlertOctagon className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => onDeleteMessage(selectedChat.id, msg.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 cursor-pointer transition"
                            title="Delete offending message"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-8 text-slate-500 text-center space-y-2.5">
              <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600">
                <MessageSquare className="w-6 h-6" />
              </div>
              <p className="text-xs font-medium max-w-xs">{t('selectChatToInspect')}</p>
              <button
                onClick={() => setMobileChatView('list')}
                className="md:hidden mt-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold border border-slate-700 cursor-pointer"
              >
                {t('backToChatList')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
