import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { usePathname, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import JovialProShell from "@/components/ui/JovialProShell";
import { useAuth } from "@/providers/AuthProvider";
import { useEstablishment } from "@/providers/EstablishmentProvider";
import { Pastel } from "@/constants/pastel";
import { Font } from "@/constants/typography";
import {
  approvePost,
  Club,
  ClubPost,
  createClub,
  deletePost,
  getClubByVenue,
  listClubPosts,
  listPendingPosts,
  togglePinPost,
} from "@/services/club";
import { subscriptionHasFeature } from "@/utils/planFeatureGate";

export default function ClubJovialScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const { venue, subscription, loading: estLoading } = useEstablishment();

  const [loading, setLoading] = useState(true);
  const venueId = venue?.id ?? null;
  const hasAccess = subscriptionHasFeature(subscription, "hasClubJovial");
  const [club, setClub] = useState<Club | null>(null);
  const [posts, setPosts] = useState<ClubPost[]>([]);
  const [pendingPosts, setPendingPosts] = useState<ClubPost[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Création d'un nouveau club
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newIsPrivate, setNewIsPrivate] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!venue) return;
    setLoading(true);
    setError(null);
    try {
      if (hasAccess) {
        const fetchedClub = await getClubByVenue(venue.id);
        setClub(fetchedClub);
        if (fetchedClub) {
          const [fetchedPosts, fetchedPending] = await Promise.all([
            listClubPosts(fetchedClub.id),
            fetchedClub.require_post_approval
              ? listPendingPosts(fetchedClub.id)
              : Promise.resolve([]),
          ]);
          setPosts(fetchedPosts);
          setPendingPosts(fetchedPending);
        }
      }
    } catch {
      setError("Impossible de charger le Club Jovial.");
    } finally {
      setLoading(false);
    }
  }, [venue, hasAccess]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreateClub = async () => {
    if (!venueId || !newName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const created = await createClub({
        venue_id: venueId,
        name: newName.trim(),
        description: newDescription.trim() || null,
        is_private: newIsPrivate,
      });
      setClub(created);
      setCreating(false);
    } catch (err: any) {
      setError(err?.message ?? "Création impossible. Vérifie ton offre.");
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePin = async (post: ClubPost) => {
    try {
      await togglePinPost(post.id, !post.is_pinned);
      setPosts((prev) =>
        prev.map((p) => (p.id === post.id ? { ...p, is_pinned: !post.is_pinned } : p))
      );
    } catch {
      Alert.alert("Erreur", "Impossible de modifier l'épinglage.");
    }
  };

  const handleApprove = async (post: ClubPost) => {
    try {
      await approvePost(post.id);
      setPendingPosts((prev) => prev.filter((p) => p.id !== post.id));
      const approved = { ...post, is_approved: true };
      setPosts((prev) => [approved, ...prev]);
    } catch {
      Alert.alert("Erreur", "Impossible d'approuver la publication.");
    }
  };

  const handleDelete = (post: ClubPost, isPending: boolean) => {
    Alert.alert(
      "Supprimer",
      "Supprimer définitivement cette publication ?",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            try {
              await deletePost(post.id);
              if (isPending) {
                setPendingPosts((prev) => prev.filter((p) => p.id !== post.id));
              } else {
                setPosts((prev) => prev.filter((p) => p.id !== post.id));
              }
            } catch {
              Alert.alert("Erreur", "Suppression impossible.");
            }
          },
        },
      ]
    );
  };

  if (!userId) {
    return (
      <View style={styles.center}>
        <Text style={styles.centerTitle}>Connexion requise</Text>
        <Pressable style={styles.primaryBtn} onPress={() => router.push("/establishment/login")}>
          <Text style={styles.primaryBtnText}>Se connecter</Text>
        </Pressable>
      </View>
    );
  }

  // ── Mur d'upgrade : offre Visibilité ────────────────────────────────────────
  if (!hasAccess && !loading && !estLoading) {
    return (
      <JovialProShell
        currentPath={pathname}
        title="Club Jovial"
        subtitle="Créez et animez votre communauté directement depuis Jovial."
      >
        <View style={styles.lockCard}>
          <View style={styles.lockIcon}>
            <Ionicons name="lock-closed" size={36} color={"#111827"} />
          </View>
          <Text style={styles.lockTitle}>Club Jovial</Text>
          <Text style={styles.lockText}>
            Le Club Jovial est disponible à partir de l'Offre Rayonnement. Créez votre espace
            communautaire, partagez des publications avec photos, animez vos membres et publiez
            directement vos événements dans votre groupe.
          </Text>
          <View style={styles.lockFeatures}>
            {[
              "Page club publique ou privée dans l'application",
              "Publications avec photos et partage d'événements",
              "Modération des publications des membres",
              "Statistiques d'engagement (Offre Pro)",
            ].map((f) => (
              <View key={f} style={styles.lockFeatureRow}>
                <Ionicons name="checkmark-circle" size={16} color={"#111827"} />
                <Text style={styles.lockFeatureText}>{f}</Text>
              </View>
            ))}
          </View>
          <Pressable
            style={styles.primaryBtn}
            onPress={() => router.push("/establishment/subscription")}
          >
            <Text style={styles.primaryBtnText}>Passer à l'Offre Rayonnement</Text>
          </Pressable>
          <Pressable
            style={styles.secondaryBtn}
            onPress={() => router.push("/establishment/offers")}
          >
            <Text style={styles.secondaryBtnText}>Voir toutes les offres</Text>
          </Pressable>
        </View>
      </JovialProShell>
    );
  }

  // ── Création du club ─────────────────────────────────────────────────────────
  if (!club || creating) {
    return (
      <JovialProShell
        currentPath={pathname}
        title="Club Jovial"
        subtitle="Créez votre espace communautaire. Il sera visible dans l'application sous l'onglet Club."
      >
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <View style={styles.createCard}>
          <Text style={styles.createTitle}>Créer mon Club Jovial</Text>
          <Text style={styles.createSubtitle}>
            Votre club apparaîtra dans la section Club de l'application Jovial. Les utilisateurs
            pourront le rejoindre, suivre vos publications et interagir avec votre établissement.
          </Text>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Nom du club *</Text>
            <TextInput
              style={styles.input}
              value={newName}
              onChangeText={setNewName}
              placeholder="ex : Le Cercle du Comptoir"
              placeholderTextColor={"#9CA3AF"}
              maxLength={60}
            />
            <Text style={styles.fieldHint}>{newName.length}/60 caractères</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={newDescription}
              onChangeText={setNewDescription}
              placeholder="Décrivez votre club en quelques mots…"
              placeholderTextColor={"#9CA3AF"}
              multiline
              maxLength={300}
            />
            <Text style={styles.fieldHint}>{newDescription.length}/300 caractères</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Confidentialité</Text>
            <View style={styles.privacyRow}>
              <Pressable style={[styles.privacyCard, !newIsPrivate && styles.privacyCardActive]} onPress={() => setNewIsPrivate(false)}>
                <Ionicons name="globe-outline" size={18} color={!newIsPrivate ? Pastel.teal : Pastel.textMuted} />
                <Text style={[styles.privacyLabel, !newIsPrivate && styles.privacyLabelActive]}>Public</Text>
                <Text style={styles.privacyDesc}>Tout le monde peut voir les publications.</Text>
              </Pressable>
              <Pressable style={[styles.privacyCard, newIsPrivate && styles.privacyCardPrivate]} onPress={() => setNewIsPrivate(true)}>
                <Ionicons name="lock-closed-outline" size={18} color={newIsPrivate ? Pastel.primary : Pastel.textMuted} />
                <Text style={[styles.privacyLabel, newIsPrivate && { color: Pastel.primary }]}>Privé</Text>
                <Text style={styles.privacyDesc}>Les membres doivent rejoindre pour voir.</Text>
              </Pressable>
            </View>
          </View>

          <Pressable
            style={[styles.primaryBtn, (!newName.trim() || saving) ? styles.btnDisabled : null]}
            onPress={handleCreateClub}
            disabled={!newName.trim() || saving}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryBtnText}>Créer le club</Text>
            )}
          </Pressable>
          {creating && (
            <Pressable style={styles.secondaryBtn} onPress={() => setCreating(false)}>
              <Text style={styles.secondaryBtnText}>Annuler</Text>
            </Pressable>
          )}
        </View>
      </JovialProShell>
    );
  }

  // ── Tableau de bord du club ──────────────────────────────────────────────────
  return (
    <JovialProShell
      currentPath={pathname}
      title="Club Jovial"
      subtitle={`Gérez votre club, vos publications et vos membres.`}
      loading={loading}
    >
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {/* En-tête du club */}
      <View style={styles.clubHeader}>
        {club.cover_photo_url ? (
          <Image source={{ uri: club.cover_photo_url }} style={styles.clubCover} />
        ) : (
          <View style={styles.clubCoverPlaceholder}>
            <Ionicons name="image-outline" size={32} color={"#9CA3AF"} />
            <Text style={styles.clubCoverPlaceholderText}>Ajouter une photo de couverture</Text>
          </View>
        )}
        <View style={styles.clubMeta}>
          {club.profile_photo_url ? (
            <Image source={{ uri: club.profile_photo_url }} style={styles.clubAvatar} />
          ) : (
            <View style={styles.clubAvatarPlaceholder}>
              <Ionicons name="people" size={22} color={"#111827"} />
            </View>
          )}
          <View style={styles.clubMetaText}>
            <View style={styles.clubNameRow}>
              <Text style={styles.clubName}>{club.name}</Text>
              {club.is_private ? (
                <View style={styles.privatePill}>
                  <Ionicons name="lock-closed" size={11} color={Pastel.primary} />
                  <Text style={styles.privatePillText}>Privé</Text>
                </View>
              ) : (
                <View style={styles.publicPill}>
                  <Ionicons name="globe-outline" size={11} color={Pastel.teal} />
                  <Text style={styles.publicPillText}>Public</Text>
                </View>
              )}
            </View>
            {/* Badge Club Officiel */}
            <View style={styles.officialBadge}>
              <Ionicons name="shield-checkmark" size={13} color={Pastel.teal} />
              <Text style={styles.officialBadgeText}>Club Officiel Jovial</Text>
            </View>
            {club.description ? (
              <Text style={styles.clubDescription} numberOfLines={2}>
                {club.description}
              </Text>
            ) : null}
          </View>
        </View>
      </View>

      {/* Statistiques */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{club.member_count}</Text>
          <Text style={styles.statLabel}>Membres</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{club.post_count}</Text>
          <Text style={styles.statLabel}>Publications</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{pendingPosts.length}</Text>
          <Text style={styles.statLabel}>En attente</Text>
        </View>
      </View>

      {/* Actions rapides */}
      <View style={styles.actionsRow}>
        <Pressable
          style={[styles.primaryBtn, styles.actionBtn]}
          onPress={() =>
            router.push({
              pathname: "/establishment/club/new-post",
              params: { clubId: club.id, venueId: venueId! },
            })
          }
        >
          <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />
          <Text style={styles.primaryBtnText}>Nouvelle publication</Text>
        </Pressable>
        <Pressable
          style={[styles.secondaryBtn, styles.actionBtn]}
          onPress={() =>
            router.push({
              pathname: "/establishment/club/edit",
              params: { clubId: club.id, venueId: venueId! },
            })
          }
        >
          <Ionicons name="settings-outline" size={18} color={"#111827"} />
          <Text style={styles.secondaryBtnText}>Paramètres du club</Text>
        </Pressable>
      </View>

      {/* Publications en attente de modération */}
      {pendingPosts.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="time-outline" size={16} color={"#111827"} />
            {"  "}En attente de validation ({pendingPosts.length})
          </Text>
          {pendingPosts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              isPending
              onApprove={() => handleApprove(post)}
              onDelete={() => handleDelete(post, true)}
            />
          ))}
        </View>
      ) : null}

      {/* Publications publiées */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Publications</Text>
        {posts.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="newspaper-outline" size={32} color={"#9CA3AF"} />
            <Text style={styles.emptyText}>
              Aucune publication pour l'instant. Partagez une actualité, un événement ou une photo
              avec vos membres.
            </Text>
          </View>
        ) : (
          posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onTogglePin={() => handleTogglePin(post)}
              onDelete={() => handleDelete(post, false)}
            />
          ))
        )}
      </View>
    </JovialProShell>
  );
}

// ── PostCard ──────────────────────────────────────────────────────────────────

type PostCardProps = {
  post: ClubPost;
  isPending?: boolean;
  onTogglePin?: () => void;
  onApprove?: () => void;
  onDelete: () => void;
};

function PostCard({ post, isPending, onTogglePin, onApprove, onDelete }: PostCardProps) {
  const date = new Date(post.created_at).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <View style={[postStyles.card, post.is_pinned ? postStyles.pinnedCard : null]}>
      {post.is_pinned ? (
        <View style={postStyles.pinnedBadge}>
          <Ionicons name="pin" size={12} color={"#111827"} />
          <Text style={postStyles.pinnedBadgeText}>Épinglée</Text>
        </View>
      ) : null}

      {/* Événement partagé */}
      {post.shared_event ? (
        <View style={postStyles.eventBadge}>
          <Ionicons name="calendar-outline" size={13} color={"#111827"} />
          <Text style={postStyles.eventBadgeText} numberOfLines={1}>
            {post.shared_event.title}
          </Text>
        </View>
      ) : null}

      <Text style={postStyles.content} numberOfLines={3}>
        {post.content}
      </Text>

      {/* Aperçu photos */}
      {post.photo_urls.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={postStyles.photosRow}>
          {post.photo_urls.map((url, i) => (
            <Image key={i} source={{ uri: url }} style={postStyles.photoThumb} />
          ))}
        </ScrollView>
      ) : null}

      <View style={postStyles.footer}>
        <Text style={postStyles.date}>{date}</Text>
        <View style={postStyles.footerStats}>
          <View style={postStyles.stat}>
            <Ionicons name="heart-outline" size={13} color={"#9CA3AF"} />
            <Text style={postStyles.statText}>{post.likes_count}</Text>
          </View>
          <View style={postStyles.stat}>
            <Ionicons name="chatbubble-outline" size={13} color={"#9CA3AF"} />
            <Text style={postStyles.statText}>{post.comments_count}</Text>
          </View>
        </View>
        <View style={postStyles.actions}>
          {isPending && onApprove ? (
            <Pressable style={postStyles.approveBtn} onPress={onApprove}>
              <Ionicons name="checkmark" size={14} color="#1E7A36" />
              <Text style={postStyles.approveBtnText}>Approuver</Text>
            </Pressable>
          ) : null}
          {onTogglePin ? (
            <Pressable style={postStyles.iconBtn} onPress={onTogglePin}>
              <Ionicons
                name={post.is_pinned ? "pin" : "pin-outline"}
                size={16}
                color={post.is_pinned ? "#111827" : "#9CA3AF"}
              />
            </Pressable>
          ) : null}
          <Pressable style={postStyles.iconBtn} onPress={onDelete}>
            <Ionicons name="trash-outline" size={16} color="#EF4444" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 20 },
  centerTitle: { fontSize: 20, fontFamily: Font.bold, color: Pastel.text, includeFontPadding: false },
  errorText: { color: "#EF4444", fontSize: 13, fontFamily: Font.semiBold, includeFontPadding: false },

  // Upgrade wall
  lockCard: { backgroundColor: Pastel.surface, borderRadius: 24, borderWidth: 1, borderColor: Pastel.border, padding: 24, gap: 16, maxWidth: 560 },
  lockIcon: { width: 60, height: 60, borderRadius: 18, backgroundColor: Pastel.primarySoft, alignItems: "center", justifyContent: "center" },
  lockTitle: { color: Pastel.text, fontSize: 24, fontFamily: Font.extraBold, includeFontPadding: false },
  lockText: { color: Pastel.textMuted, fontSize: 14, lineHeight: 21, includeFontPadding: false },
  lockFeatures: { gap: 10 },
  lockFeatureRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  lockFeatureText: { color: Pastel.text, fontSize: 14, flex: 1, fontFamily: Font.regular, includeFontPadding: false },

  // Création
  createCard: { backgroundColor: Pastel.surface, borderRadius: 24, borderWidth: 1, borderColor: Pastel.border, padding: 22, gap: 18, maxWidth: 600 },
  createTitle: { color: Pastel.text, fontSize: 22, fontFamily: Font.extraBold, includeFontPadding: false },
  createSubtitle: { color: Pastel.textMuted, fontSize: 14, lineHeight: 20, includeFontPadding: false },
  field: { gap: 8 },
  fieldLabel: { color: Pastel.text, fontSize: 13, fontFamily: Font.extraBold, includeFontPadding: false },
  fieldHint: { color: Pastel.textMuted, fontSize: 11, includeFontPadding: false },
  input: { borderWidth: 1, borderColor: Pastel.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, color: Pastel.text, backgroundColor: Pastel.surfaceAlt, fontSize: 14, fontFamily: Font.regular },
  textArea: { minHeight: 90, textAlignVertical: "top" },
  privacyRow: { flexDirection: "row", gap: 10 },
  privacyCard: { flex: 1, borderRadius: 14, borderWidth: 1, borderColor: Pastel.border, backgroundColor: Pastel.surfaceAlt, padding: 12, gap: 4, alignItems: "center" },
  privacyCardActive: { borderColor: Pastel.teal, backgroundColor: Pastel.tealSoft },
  privacyCardPrivate: { borderColor: Pastel.primary, backgroundColor: Pastel.primarySoft },
  privacyLabel: { color: Pastel.text, fontSize: 13, fontFamily: Font.extraBold, includeFontPadding: false },
  privacyLabelActive: { color: Pastel.teal },
  privacyDesc: { color: Pastel.textMuted, fontSize: 11, textAlign: "center", lineHeight: 15, includeFontPadding: false },

  // En-tête club
  clubHeader: { backgroundColor: Pastel.surface, borderRadius: 22, borderWidth: 1, borderColor: Pastel.border, overflow: "hidden" },
  clubCover: { width: "100%", height: 140 },
  clubCoverPlaceholder: { height: 90, backgroundColor: Pastel.surfaceAlt, alignItems: "center", justifyContent: "center", gap: 6, borderBottomWidth: 1, borderBottomColor: Pastel.border },
  clubCoverPlaceholderText: { color: Pastel.textMuted, fontSize: 12, fontFamily: Font.semiBold, includeFontPadding: false },
  clubMeta: { flexDirection: "row", alignItems: "flex-start", gap: 14, padding: 16, paddingTop: 12 },
  clubAvatar: { width: 52, height: 52, borderRadius: 16, borderWidth: 2, borderColor: Pastel.border },
  clubAvatarPlaceholder: { width: 52, height: 52, borderRadius: 16, backgroundColor: Pastel.surfaceAlt, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: Pastel.border },
  clubMetaText: { flex: 1, gap: 4 },
  clubNameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  clubName: { color: Pastel.text, fontSize: 18, fontFamily: Font.extraBold, includeFontPadding: false },
  privatePill: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: Pastel.primarySoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: Pastel.primary },
  privatePillText: { color: Pastel.primary, fontSize: 11, fontFamily: Font.bold, includeFontPadding: false },
  publicPill: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: Pastel.tealSoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: Pastel.teal },
  publicPillText: { color: Pastel.teal, fontSize: 11, fontFamily: Font.bold, includeFontPadding: false },
  clubDescription: { color: Pastel.textMuted, fontSize: 13, lineHeight: 19, includeFontPadding: false },

  // Stats
  statsRow: { flexDirection: "row", gap: 12 },
  statCard: { flex: 1, backgroundColor: Pastel.surface, borderRadius: 18, borderWidth: 1, borderColor: Pastel.border, padding: 14, alignItems: "center", gap: 4 },
  statValue: { color: Pastel.teal, fontSize: 26, fontFamily: Font.display, includeFontPadding: false },
  statLabel: { color: Pastel.textMuted, fontSize: 11, fontFamily: Font.semiBold, textAlign: "center", includeFontPadding: false },

  // Actions
  actionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  actionBtn: { flex: 1, flexDirection: "row", gap: 8, minWidth: 180 },

  // Section
  section: { gap: 10 },
  sectionTitle: { color: Pastel.text, fontSize: 17, fontFamily: Font.extraBold, includeFontPadding: false },
  emptyBox: { backgroundColor: Pastel.surface, borderRadius: 20, borderWidth: 1, borderColor: Pastel.border, padding: 28, alignItems: "center", gap: 12 },
  emptyText: { color: Pastel.textMuted, fontSize: 14, lineHeight: 21, textAlign: "center", maxWidth: 400, includeFontPadding: false },

  // Boutons
  primaryBtn: { backgroundColor: Pastel.primary, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 18, alignItems: "center", justifyContent: "center" },
  primaryBtnText: { color: "#FFFFFF", fontFamily: Font.extraBold, fontSize: 14, includeFontPadding: false },
  secondaryBtn: { backgroundColor: Pastel.surface, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 18, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Pastel.border },
  secondaryBtnText: { color: Pastel.text, fontFamily: Font.bold, fontSize: 14, includeFontPadding: false },
  btnDisabled: { opacity: 0.5 },

  // Badge officiel
  officialBadge: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", backgroundColor: Pastel.tealSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: Pastel.teal },
  officialBadgeText: { color: Pastel.teal, fontSize: 11, fontFamily: Font.extraBold, includeFontPadding: false },
});

const postStyles = StyleSheet.create({
  card: { backgroundColor: Pastel.surface, borderRadius: 18, borderWidth: 1, borderColor: Pastel.border, padding: 16, gap: 10 },
  pinnedCard: { borderColor: "#F59E0B", borderWidth: 2, backgroundColor: "#FFFDF0" },
  pinnedBadge: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", backgroundColor: "#FFFBEB", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: "#F59E0B" },
  pinnedBadgeText: { color: "#92400E", fontSize: 11, fontFamily: Font.bold, includeFontPadding: false },
  eventBadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Pastel.primarySoft, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, alignSelf: "flex-start", borderWidth: 1, borderColor: Pastel.primary },
  eventBadgeText: { color: Pastel.primary, fontSize: 12, fontFamily: Font.bold, maxWidth: 200, includeFontPadding: false },
  content: { color: Pastel.text, fontSize: 14, lineHeight: 21, fontFamily: Font.regular, includeFontPadding: false },
  photosRow: { marginHorizontal: -4 },
  photoThumb: { width: 80, height: 80, borderRadius: 10, marginHorizontal: 4, backgroundColor: Pastel.surfaceAlt },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  date: { color: Pastel.textMuted, fontSize: 12, fontFamily: Font.regular, includeFontPadding: false },
  footerStats: { flexDirection: "row", gap: 12 },
  stat: { flexDirection: "row", alignItems: "center", gap: 4 },
  statText: { color: Pastel.textMuted, fontSize: 12, fontFamily: Font.regular, includeFontPadding: false },
  actions: { flexDirection: "row", alignItems: "center", gap: 6 },
  approveBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: Pastel.tealSoft, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: Pastel.teal },
  approveBtnText: { color: Pastel.teal, fontSize: 12, fontFamily: Font.bold, includeFontPadding: false },
  iconBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: Pastel.surfaceAlt, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Pastel.border },
});
