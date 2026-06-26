/**
 * Namespace i18n — Messagerie interne chiffrée.
 * Clés préfixées `messagerie.` (FR/EN strictement alignées).
 */
export const messagerie = {
  fr: {
    // ── En-tête de page ─────────────────────────────────────────────
    pageTitle: 'Messagerie interne',
    encrypted: 'chiffrée',
    unreadCount_one: '· {{count}} non lu',
    unreadCount_other: '· {{count}} non lus',
    newMessage: 'Nouveau message',

    // ── Liste des conversations ─────────────────────────────────────
    searchConversation: 'Rechercher une conversation…',
    loading: 'Chargement…',
    noConversation: 'Aucune conversation',
    tryAnotherName: 'Essayez un autre nom',
    startWithNew: 'Démarrez-en une avec « Nouveau message »',
    resizeHandle: 'Glisser pour redimensionner',

    // ── État vide (fil) ─────────────────────────────────────────────
    emptySelectOrStart: 'Sélectionnez une conversation\nou démarrez-en une nouvelle',
    emptyEncryptedNote: 'Vos échanges sont chiffrés (AES-256) au repos.',

    // ── Panneau « Nouveau message » ─────────────────────────────────
    directMessage: 'Message direct',
    group: 'Groupe',
    groupNamePlaceholder: 'Nom du groupe…',
    searchAgent: 'Rechercher un agent…',
    noAgent: 'Aucun agent',
    selectedCount_one: '{{count}} sélectionné',
    selectedCount_other: '{{count}} sélectionnés',
    createGroup: 'Créer le groupe',
    startConversationError: 'Impossible de démarrer la conversation',
    createGroupError: 'Impossible de créer le groupe',

    // ── Carte conversation ──────────────────────────────────────────
    noMessage: 'Aucun message',
    youPrefix: 'Vous : ',
    yesterday: 'Hier',
    cardActions: 'Actions',
    leaveGroup: 'Quitter le groupe',
    deleteConversation: 'Supprimer la conversation',

    // ── Suppression / sortie d'une conversation ─────────────────────
    confirmLeaveGroup: 'Quitter le groupe « {{titre}} » ?',
    confirmDeleteConversation: 'Supprimer la conversation avec {{titre}} ?',
    groupLeft: 'Groupe quitté',
    conversationDeleted: 'Conversation supprimée',
    deleteConversationTitle: 'Supprimer la conversation ?',
    leaveGroupTitle: 'Quitter le groupe ?',
    actionImpossible: 'Action impossible',

    // ── Fil de conversation : en-tête ───────────────────────────────
    groupHeaderParticipants: '{{count}} participants · {{noms}}',
    online: '● en ligne',
    seenToday: "vu aujourd'hui à {{heure}}",
    seenYesterday: 'vu hier à {{heure}}',
    seenOn: 'vu le {{date}} à {{heure}}',

    // ── Libellés de date ────────────────────────────────────────────
    today: "Aujourd'hui",

    // ── Fil : états ─────────────────────────────────────────────────
    conversationStart: 'Début de la conversation',
    previousMessages: 'Messages précédents',
    scrollDown: 'Descendre',

    // ── Barre de réponse ────────────────────────────────────────────
    replyTo: 'Réponse à {{auteur}}',
    you: 'Vous',
    cancel: 'Annuler',
    attachmentPreview: '📎 Pièce jointe',

    // ── Sélection multiple ──────────────────────────────────────────
    selectedMessages_one: '{{count}} sélectionné',
    selectedMessages_other: '{{count}} sélectionnés',
    deleteForMe: 'Pour moi',
    deleteForEveryone: 'Pour tout le monde',

    // ── Composeur ───────────────────────────────────────────────────
    emoji: 'Emoji',
    stickers: 'Stickers',
    emojiCredit: 'Emojis : Twemoji (CC-BY 4.0)',
    attach: 'Joindre',
    photosAndVideos: 'Photos & vidéos',
    audio: 'Audio',
    document: 'Document',
    send: 'Envoyer',
    composerPlaceholder: 'Écrire un message…  (Entrée pour envoyer)',
    typing: 'en train d’écrire…',
    recordingAudio: 'en train d’enregistrer un message vocal…',
    voiceNote: 'Note vocale',

    // ── Toasts d'envoi ──────────────────────────────────────────────
    sendError: "Échec de l'envoi",
    voiceSendError: "Échec de l'envoi de la note vocale",
    updateError: 'Échec de la modification',
    deleteError: 'Échec de la suppression',
    copied: 'Copié',

    // ── Dialogue suppression multiple ───────────────────────────────
    deleteForEveryoneTitle: 'Supprimer pour tout le monde ?',
    multiDeleteBody_one: '{{count}} message sélectionné. Seuls vos messages de moins de 15 min seront supprimés pour tout le monde ; les autres resteront.',
    multiDeleteBody_other: '{{count}} messages sélectionnés. Seuls vos messages de moins de 15 min seront supprimés pour tout le monde ; les autres resteront.',
    delete: 'Supprimer',

    // ── Bulle : méta & accusés ──────────────────────────────────────
    sending: 'envoi…',
    edited: '· modifié',
    readBy: 'Lu par {{count}}',
    deliveredTo: 'Remis à {{count}}',
    sent: 'Envoyé',
    readAt: 'Lu à {{heure}}',
    read: 'Lu',
    delivered: 'Remis',

    // ── Réactions ───────────────────────────────────────────────────
    removeReaction: 'Retirer',
    react: 'Réagir',
    reactWith: 'Réagir {{emoji}}',
    addReaction: 'Ajouter une réaction',
    addEmoji: 'Ajouter un emoji',
    back: 'Retour',

    // ── Menu d'actions du message ───────────────────────────────────
    actions: 'Actions',
    reply: 'Répondre',
    copy: 'Copier',
    details: 'Détails',
    select: 'Sélectionner',
    edit: 'Modifier',

    // ── Édition d'un message ────────────────────────────────────────
    save: 'Enregistrer',

    // ── Réponse citée ───────────────────────────────────────────────
    goToMessage: 'Aller au message',

    // ── Modale « Détails du message » ───────────────────────────────
    messageDetails: 'Détails du message',
    close: 'Fermer',
    detailSent: 'Envoyé',
    detailEdited: 'Modifié',
    detailAttachment: 'Pièce jointe',
    yesValue: 'Oui',
    recipientsCount: 'Destinataires ({{count}})',
    recipient: 'Destinataire',
    detailReadAt: 'Lu · {{heure}}',
    detailRead: 'Lu',
    detailDelivered: 'Remis',
    detailSentStatus: 'Envoyé',

    // ── Dialogue « Supprimer » (1 message) ──────────────────────────
    deleteMessageTitle: 'Supprimer le message ?',
    deleteMessageBodyAll: 'Pour tout le monde (≤ 15 min) ou seulement pour vous.',
    deleteMessageBodyMe: 'Le message sera supprimé uniquement pour vous.',
    deleteForEveryoneAction: 'Supprimer pour tout le monde',
    deleteForMeAction: 'Supprimer pour moi',

    // ── Pièces jointes ──────────────────────────────────────────────
    open: 'Ouvrir {{nom}}',
    play: 'Lire {{nom}}',
    download: 'Télécharger {{nom}}',
    pause: 'Pause',
    listen: 'Écouter',
    playbackSpeed: 'Vitesse de lecture',

    // ── Lecteur média (MediaViewer) ─────────────────────────────────
    openMediaError: "Impossible d'ouvrir ce média",
    downloadAction: 'Télécharger',

    // ── Aperçu média (MediaPreview) ─────────────────────────────────
    preview: 'Aperçu',
    preparingMedia: 'Préparation des médias…',
    noMedia: 'Aucun média',
    captionPlaceholder: 'Ajouter une légende…',
    remove: 'Retirer',
    add: 'Ajouter',
    removeErrorFiles: 'Retirez le(s) fichier(s) en erreur',
    trimmingExtract: "Découpe de l'extrait…",
    trimToolFirstRun: "Le 1er découpage prépare l'outil (~30 Mo, une seule fois).",
    chooseExtract: 'Choisissez un extrait ≤ {{duree}}',
    trimStart: 'Début',
    trimEnd: 'Fin',
    compressedNote: 'compressée · {{avant}} → {{apres}}',
    imageTooHeavy: 'Image trop lourde ({{taille}})',
    videoTooHeavyUnknown: 'Vidéo trop lourde ({{taille}}) — durée indéterminée, découpe impossible',
    audioTooHeavy: 'Audio trop lourd : {{taille}} (max {{max}})',
    documentTooHeavy: 'Document trop lourd : {{taille}} (max {{max}})',
    cannotTrim: 'Impossible de découper « {{nom}} »',
    extractStillTooHeavy: "L'extrait dépasse encore {{max}} — réduisez la sélection",

    // ── Enregistreur de note vocale ─────────────────────────────────
    micUnavailable: "Micro inaccessible — autorisez l'accès au microphone.",
    sendVoiceNote: 'Envoyer la note vocale',
    voiceNoteFilename: 'note-vocale',
  },
  en: {
    // ── En-tête de page ─────────────────────────────────────────────
    pageTitle: 'Internal messaging',
    encrypted: 'encrypted',
    unreadCount_one: '· {{count}} unread',
    unreadCount_other: '· {{count}} unread',
    newMessage: 'New message',

    // ── Liste des conversations ─────────────────────────────────────
    searchConversation: 'Search a conversation…',
    loading: 'Loading…',
    noConversation: 'No conversation',
    tryAnotherName: 'Try another name',
    startWithNew: 'Start one with “New message”',
    resizeHandle: 'Drag to resize',

    // ── État vide (fil) ─────────────────────────────────────────────
    emptySelectOrStart: 'Select a conversation\nor start a new one',
    emptyEncryptedNote: 'Your exchanges are encrypted (AES-256) at rest.',

    // ── Panneau « Nouveau message » ─────────────────────────────────
    directMessage: 'Direct message',
    group: 'Group',
    groupNamePlaceholder: 'Group name…',
    searchAgent: 'Search a staff member…',
    noAgent: 'No staff member',
    selectedCount_one: '{{count}} selected',
    selectedCount_other: '{{count}} selected',
    createGroup: 'Create group',
    startConversationError: 'Unable to start the conversation',
    createGroupError: 'Unable to create the group',

    // ── Carte conversation ──────────────────────────────────────────
    noMessage: 'No message',
    youPrefix: 'You: ',
    yesterday: 'Yesterday',
    cardActions: 'Actions',
    leaveGroup: 'Leave group',
    deleteConversation: 'Delete conversation',

    // ── Suppression / sortie d'une conversation ─────────────────────
    confirmLeaveGroup: 'Leave the group “{{titre}}”?',
    confirmDeleteConversation: 'Delete the conversation with {{titre}}?',
    groupLeft: 'Group left',
    conversationDeleted: 'Conversation deleted',
    deleteConversationTitle: 'Delete conversation?',
    leaveGroupTitle: 'Leave group?',
    actionImpossible: 'Action failed',

    // ── Fil de conversation : en-tête ───────────────────────────────
    groupHeaderParticipants: '{{count}} participants · {{noms}}',
    online: '● online',
    seenToday: 'seen today at {{heure}}',
    seenYesterday: 'seen yesterday at {{heure}}',
    seenOn: 'seen on {{date}} at {{heure}}',

    // ── Libellés de date ────────────────────────────────────────────
    today: 'Today',

    // ── Fil : états ─────────────────────────────────────────────────
    conversationStart: 'Start of the conversation',
    previousMessages: 'Previous messages',
    scrollDown: 'Scroll down',

    // ── Barre de réponse ────────────────────────────────────────────
    replyTo: 'Reply to {{auteur}}',
    you: 'You',
    cancel: 'Cancel',
    attachmentPreview: '📎 Attachment',

    // ── Sélection multiple ──────────────────────────────────────────
    selectedMessages_one: '{{count}} selected',
    selectedMessages_other: '{{count}} selected',
    deleteForMe: 'For me',
    deleteForEveryone: 'For everyone',

    // ── Composeur ───────────────────────────────────────────────────
    emoji: 'Emoji',
    stickers: 'Stickers',
    emojiCredit: 'Emojis: Twemoji (CC-BY 4.0)',
    attach: 'Attach',
    photosAndVideos: 'Photos & videos',
    audio: 'Audio',
    document: 'Document',
    send: 'Send',
    composerPlaceholder: 'Write a message…  (Enter to send)',
    typing: 'typing…',
    recordingAudio: 'recording a voice message…',
    voiceNote: 'Voice note',

    // ── Toasts d'envoi ──────────────────────────────────────────────
    sendError: 'Failed to send',
    voiceSendError: 'Failed to send the voice note',
    updateError: 'Failed to edit',
    deleteError: 'Failed to delete',
    copied: 'Copied',

    // ── Dialogue suppression multiple ───────────────────────────────
    deleteForEveryoneTitle: 'Delete for everyone?',
    multiDeleteBody_one: '{{count}} message selected. Only your messages less than 15 min old will be deleted for everyone; the others will remain.',
    multiDeleteBody_other: '{{count}} messages selected. Only your messages less than 15 min old will be deleted for everyone; the others will remain.',
    delete: 'Delete',

    // ── Bulle : méta & accusés ──────────────────────────────────────
    sending: 'sending…',
    edited: '· edited',
    readBy: 'Read by {{count}}',
    deliveredTo: 'Delivered to {{count}}',
    sent: 'Sent',
    readAt: 'Read at {{heure}}',
    read: 'Read',
    delivered: 'Delivered',

    // ── Réactions ───────────────────────────────────────────────────
    removeReaction: 'Remove',
    react: 'React',
    reactWith: 'React {{emoji}}',
    addReaction: 'Add a reaction',
    addEmoji: 'Add an emoji',
    back: 'Back',

    // ── Menu d'actions du message ───────────────────────────────────
    actions: 'Actions',
    reply: 'Reply',
    copy: 'Copy',
    details: 'Details',
    select: 'Select',
    edit: 'Edit',

    // ── Édition d'un message ────────────────────────────────────────
    save: 'Save',

    // ── Réponse citée ───────────────────────────────────────────────
    goToMessage: 'Go to message',

    // ── Modale « Détails du message » ───────────────────────────────
    messageDetails: 'Message details',
    close: 'Close',
    detailSent: 'Sent',
    detailEdited: 'Edited',
    detailAttachment: 'Attachment',
    yesValue: 'Yes',
    recipientsCount: 'Recipients ({{count}})',
    recipient: 'Recipient',
    detailReadAt: 'Read · {{heure}}',
    detailRead: 'Read',
    detailDelivered: 'Delivered',
    detailSentStatus: 'Sent',

    // ── Dialogue « Supprimer » (1 message) ──────────────────────────
    deleteMessageTitle: 'Delete the message?',
    deleteMessageBodyAll: 'For everyone (≤ 15 min) or only for you.',
    deleteMessageBodyMe: 'The message will be deleted only for you.',
    deleteForEveryoneAction: 'Delete for everyone',
    deleteForMeAction: 'Delete for me',

    // ── Pièces jointes ──────────────────────────────────────────────
    open: 'Open {{nom}}',
    play: 'Play {{nom}}',
    download: 'Download {{nom}}',
    pause: 'Pause',
    listen: 'Listen',
    playbackSpeed: 'Playback speed',

    // ── Lecteur média (MediaViewer) ─────────────────────────────────
    openMediaError: 'Unable to open this media',
    downloadAction: 'Download',

    // ── Aperçu média (MediaPreview) ─────────────────────────────────
    preview: 'Preview',
    preparingMedia: 'Preparing media…',
    noMedia: 'No media',
    captionPlaceholder: 'Add a caption…',
    remove: 'Remove',
    add: 'Add',
    removeErrorFiles: 'Remove the file(s) in error',
    trimmingExtract: 'Trimming the clip…',
    trimToolFirstRun: 'The first trim prepares the tool (~30 MB, one time only).',
    chooseExtract: 'Choose a clip ≤ {{duree}}',
    trimStart: 'Start',
    trimEnd: 'End',
    compressedNote: 'compressed · {{avant}} → {{apres}}',
    imageTooHeavy: 'Image too heavy ({{taille}})',
    videoTooHeavyUnknown: 'Video too heavy ({{taille}}) — duration unknown, trimming impossible',
    audioTooHeavy: 'Audio too heavy: {{taille}} (max {{max}})',
    documentTooHeavy: 'Document too heavy: {{taille}} (max {{max}})',
    cannotTrim: 'Unable to trim “{{nom}}”',
    extractStillTooHeavy: 'The clip still exceeds {{max}} — reduce the selection',

    // ── Enregistreur de note vocale ─────────────────────────────────
    micUnavailable: 'Microphone unavailable — please allow microphone access.',
    sendVoiceNote: 'Send the voice note',
    voiceNoteFilename: 'voice-note',
  },
}
