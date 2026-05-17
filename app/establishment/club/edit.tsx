import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import {
  Club,
  getClubByVenue,
  updateClub,
  uploadClubCoverPhoto,
  uploadClubProfilePhoto,
} from "@/services/club";

export default function ClubEditScreen() {
  const router = useRouter();
  const { clubId, venueId } = useLocalSearchParams<{ clubId?: string; venueId?: string }>();

  const parsedClubId = clubId ? parseInt(clubId, 10) : null;
  const parsedVenueId = venueId ? parseInt(venueId, 10) : null;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingProfile, setUploadingProfile] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const [club, setClub] = useState<Club | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [allowMemberPosts, setAllowMemberPosts] = useState(true);
  const [allowMemberComments, setAllowMemberComments] = useState(true);
  const [requirePostApproval, setRequirePostApproval] = useState(false);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [coverPhotoUrl, setCoverPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!parsedVenueId) return;
    const load = async () => {
      try {
        const fetched = await getClubByVenue(parsedVenueId);
        if (!fetched) { router.back(); return; }
        setClub(fetched);
        setName(fetched.name);
        setDescription(fetched.description ?? "");
        setIsPrivate(fetched.is_private);
        setAllowMemberPosts(fetched.allow_member_posts);
        setAllowMemberComments(fetched.allow_member_comments);
        setRequirePostApproval(fetched.require_post_approval);
        setProfilePhotoUrl(fetched.profile_photo_url);
        setCoverPhotoUrl(fetched.cover_photo_url);
      } catch {
        setError("Impossible de charger les paramètres du club.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [parsedVenueId, router]);

  const handleSave = async () => {
    if (!parsedClubId || !name.trim()) return;
    setSaving(true);
    setError(null);
    setSaveMessage(null);
    try {
      await updateClub(parsedClubId, {
        name: name.trim(),
        description: description.trim() || null,
        profile_photo_url: profilePhotoUrl,
        cover_photo_url: coverPhotoUrl,
        is_private: isPrivate,
        allow_member_posts: allowMemberPosts,
        allow_member_comments: allowMemberComments,
        require_post_approval: allowMemberPosts ? requirePostApproval : false,
      });
      setSaveMessage("Modifications enregistrées.");
      setTimeout(() => setSaveMessage(null), 3000);
    } catch {
      setError("Impossible d'enregistrer les modifications.");
    } finally {
      setSaving(false);
    }
  };

  const handleUploadProfile = async () => {
    if (!parsedVenueId) return;
    setUploadingProfile(true);
    setError(null);
    try {
      const url = await uploadClubProfilePhoto(parsedVenueId);
      if (url) setProfilePhotoUrl(url);
    } catch {
      setError("Upload impossible.");
    } finally {
      setUploadingProfile(false);
    }
  };

  const handleUploadCover = async () => {
    if (!parsedVenueId) return;
    setUploadingCover(true);
    setError(null);
    try {
      const url = await uploadClubCoverPhoto(parsedVenueId);
      if (url) setCoverPhotoUrl(url);
    } catch {
      setError("Upload impossible.");
    } finally {
      setUploadingCover(false);
    }
  };

  const handleDeactivate = () => {
    if (!parsedClubId) return;
    Alert.alert(
      "Désactiver le club",
      "Le club ne sera plus visible dans l'application. Vous pourrez le réactiver à tout moment.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Désactiver",
          style: "destructive",
          onPress: async () => {
            try {
              await updateClub(parsedClubId, { is_active: false });
              router.replace("/establishment/club");
            } catch {
              setError("Impossible de désactiver le club.");
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={"#111827"} />
      </View>
    );
  }

  if (!club) return null;

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={18} color={"#111827"} />
          <Text style={styles.backBtnText}>Retour</Text>
        </Pressable>
        <Text style={styles.pageTitle}>Paramètres du club</Text>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {saveMessage ? <Text style={styles.successText}>{saveMessage}</Text> : null}

      {/* Photos */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Visuels</Text>

        <View style={styles.photoSection}>
          <Text style={styles.fieldLabel}>Photo de couverture</Text>
          {coverPhotoUrl ? (
            <Image source={{ uri: coverPhotoUrl }} style={styles.coverPreview} />
          ) : (
            <View style={styles.coverPlaceholder}>
              <Ionicons name="image-outline" size={28} color={"#9CA3AF"} />
            </View>
          )}
          <Pressable
            style={styles.secondaryBtn}
            onPress={handleUploadCover}
            disabled={uploadingCover}
          >
            {uploadingCover ? (
              <ActivityIndicator color={"#111827"} size="small" />
            ) : (
              <Text style={styles.secondaryBtnText}>
                {coverPhotoUrl ? "Modifier la couverture" : "Ajouter une couverture"}
              </Text>
            )}
          </Pressable>
        </View>

        <View style={styles.photoSection}>
          <Text style={styles.fieldLabel}>Photo de profil</Text>
          <View style={styles.profilePhotoRow}>
            {profilePhotoUrl ? (
              <Image source={{ uri: profilePhotoUrl }} style={styles.profilePreview} />
            ) : (
              <View style={styles.profilePlaceholder}>
                <Ionicons name="people" size={24} color={"#111827"} />
              </View>
            )}
            <Pressable
              style={styles.secondaryBtn}
              onPress={handleUploadProfile}
              disabled={uploadingProfile}
            >
              {uploadingProfile ? (
                <ActivityIndicator color={"#111827"} size="small" />
              ) : (
                <Text style={styles.secondaryBtnText}>
                  {profilePhotoUrl ? "Modifier" : "Ajouter"}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>

      {/* Informations */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Informations</Text>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Nom du club *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Nom du club"
            placeholderTextColor={"#9CA3AF"}
            maxLength={60}
          />
          <Text style={styles.fieldHint}>{name.length}/60</Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Décrivez votre club…"
            placeholderTextColor={"#9CA3AF"}
            multiline
            maxLength={300}
          />
          <Text style={styles.fieldHint}>{description.length}/300</Text>
        </View>
      </View>

      {/* Confidentialité */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Confidentialité</Text>

        <SettingRow
          icon="lock-closed-outline"
          title="Club privé"
          subtitle="Seuls les membres peuvent voir les publications."
          value={isPrivate}
          onChange={setIsPrivate}
        />
      </View>

      {/* Interactions membres */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Interactions des membres</Text>

        <SettingRow
          icon="create-outline"
          title="Autoriser les publications membres"
          subtitle="Les membres peuvent partager du contenu sur votre page."
          value={allowMemberPosts}
          onChange={(v) => {
            setAllowMemberPosts(v);
            if (!v) setRequirePostApproval(false);
          }}
        />

        {allowMemberPosts ? (
          <SettingRow
            icon="shield-checkmark-outline"
            title="Modération avant publication"
            subtitle="Les publications des membres sont soumises à validation avant d'apparaître."
            value={requirePostApproval}
            onChange={setRequirePostApproval}
          />
        ) : null}

        <SettingRow
          icon="chatbubbles-outline"
          title="Autoriser les commentaires membres"
          subtitle="Les membres peuvent commenter les publications."
          value={allowMemberComments}
          onChange={setAllowMemberComments}
        />
      </View>

      {/* Sauvegarde */}
      <Pressable
        style={[styles.primaryBtn, (!name.trim() || saving) ? styles.btnDisabled : null]}
        onPress={handleSave}
        disabled={!name.trim() || saving}
      >
        {saving ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.primaryBtnText}>Enregistrer les modifications</Text>
        )}
      </Pressable>

      {/* Désactivation */}
      <View style={styles.dangerCard}>
        <View style={styles.dangerHeader}>
          <Ionicons name="pause-circle-outline" size={20} color="#B45309" />
          <Text style={styles.dangerTitle}>Mettre le club en pause</Text>
        </View>
        <Text style={styles.dangerText}>
          Votre club sera masqué dans l'application, mais toutes vos données sont conservées —
          membres, publications, paramètres. Vous pouvez le réactiver à tout moment depuis cette page.
        </Text>
        <Pressable style={styles.dangerBtn} onPress={handleDeactivate}>
          <Ionicons name="pause-outline" size={15} color="#B45309" />
          <Text style={styles.dangerBtnText}>Mettre en pause</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function SettingRow({
  icon,
  title,
  subtitle,
  value,
  onChange,
}: {
  icon: string;
  title: string;
  subtitle: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={settingStyles.row}>
      <View style={settingStyles.iconWrap}>
        <Ionicons name={icon as any} size={18} color={"#111827"} />
      </View>
      <View style={settingStyles.text}>
        <Text style={settingStyles.title}>{title}</Text>
        <Text style={settingStyles.subtitle}>{subtitle}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: "#111827" }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F8F9FA" },
  content: { padding: 20, gap: 16, paddingBottom: 48, maxWidth: 720, alignSelf: "center", width: "100%" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F8F9FA" },
  header: { gap: 8 },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" },
  backBtnText: { color: "#111827", fontSize: 13, fontWeight: "700" },
  pageTitle: { color: "#111827", fontSize: 26, fontWeight: "800" },
  errorText: { color: "#EF4444", fontSize: 13, fontWeight: "600" },
  successText: { color: "#1E7A36", fontSize: 13, fontWeight: "600" },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 20,
    gap: 16,
  },
  cardTitle: { color: "#111827", fontSize: 17, fontWeight: "800" },
  photoSection: { gap: 10 },
  profilePhotoRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  coverPreview: { width: "100%", height: 120, borderRadius: 14 },
  coverPlaceholder: {
    width: "100%",
    height: 100,
    borderRadius: 14,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  profilePreview: { width: 60, height: 60, borderRadius: 16 },
  profilePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  field: { gap: 6 },
  fieldLabel: { color: "#111827", fontSize: 13, fontWeight: "700" },
  fieldHint: { color: "#9CA3AF", fontSize: 11 },
  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: "#111827",
    backgroundColor: "#F3F4F6",
    fontSize: 14,
  },
  textArea: { minHeight: 90, textAlignVertical: "top" },
  primaryBtn: {
    backgroundColor: "#111827",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryBtnText: { color: "#FFFFFF", fontWeight: "800", fontSize: 15 },
  secondaryBtn: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignSelf: "flex-start",
  },
  secondaryBtnText: { color: "#111827", fontWeight: "700", fontSize: 13 },
  btnDisabled: { opacity: 0.5 },
  dangerCard: {
    backgroundColor: "#FFFBEB",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#FDE68A",
    padding: 20,
    gap: 10,
  },
  dangerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dangerTitle: { color: "#92400E", fontSize: 15, fontWeight: "800" },
  dangerText: { color: "#78350F", fontSize: 13, lineHeight: 20 },
  dangerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: "#FCD34D",
  },
  dangerBtnText: { color: "#B45309", fontWeight: "700", fontSize: 14 },
});

const settingStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 4,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  text: { flex: 1, gap: 2 },
  title: { color: "#111827", fontSize: 14, fontWeight: "700" },
  subtitle: { color: "#9CA3AF", fontSize: 12, lineHeight: 17 },
});
