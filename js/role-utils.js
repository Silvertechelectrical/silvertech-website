import { db } from './firebase-init.js?v=20260707';
import { getIdTokenResult } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js';
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  setDoc,
  doc,
  serverTimestamp,
  arrayUnion
} from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js';

export const ROLES = {
  guest: 'guest',
  user: 'user',
  developer: 'developer',
  service_provider: 'service_provider',
  sales: 'sales',
  sales_engineer: 'sales_engineer',
  engineer: 'engineer',
  admin: 'admin'
};

export const ROLE_CAPABILITIES = {
  [ROLES.guest]: ['browse'],
  [ROLES.user]: ['browse', 'purchase', 'request_service'],
  [ROLES.developer]: ['upload_store_assets', 'browse'],
  [ROLES.service_provider]: ['manage_service_media', 'browse'],
  [ROLES.sales]: ['edit_product_variables', 'browse'],
  [ROLES.sales_engineer]: ['edit_product_variables', 'browse'],
  [ROLES.engineer]: ['edit_product_variables', 'browse'],
  [ROLES.admin]: ['manage_users', 'manage_services', 'manage_store', 'browse']
};

export const DEFAULT_ROLE = ROLES.user;

function normalizeRole(role) {
  if (!role) return DEFAULT_ROLE;
  const normalized = String(role).toLowerCase();
  return Object.values(ROLES).includes(normalized) ? normalized : DEFAULT_ROLE;
}

export async function getUserProfile(user) {
  if (!user || !db) return null;

  try {
    const userDocRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userDocRef);
    if (userDoc.exists()) {
      return { id: userDoc.id, ...userDoc.data() };
    }

    if (user.email) {
      const snapshot = await getDocs(query(collection(db, 'users'), where('email', '==', user.email)));
      if (!snapshot.empty) {
        const docSnapshot = snapshot.docs[0];
        return { id: docSnapshot.id, ...docSnapshot.data() };
      }
    }
  } catch (error) {
    console.warn('User profile lookup failed:', error);
  }

  return null;
}

export async function ensureUserProfile(user) {
  if (!user || !db) return null;

  try {
    const profile = {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || '',
      role: DEFAULT_ROLE,
      status: 'active',
      updatedAt: serverTimestamp()
    };

    const existingProfile = await getUserProfile(user);
    if (existingProfile) {
      if (existingProfile.role) {
        profile.role = normalizeRole(existingProfile.role);
      }
      if (existingProfile.status) {
        profile.status = existingProfile.status;
      }
      if (existingProfile.createdAt) {
        profile.createdAt = existingProfile.createdAt;
      }
    } else {
      profile.createdAt = serverTimestamp();
    }

    await setDoc(doc(db, 'users', user.uid), profile, { merge: true });
    return { ...profile, id: user.uid };
  } catch (error) {
    console.warn('Failed to ensure user profile:', error);
    return null;
  }
}

export async function getUserRole(user) {
  const profile = await getUserProfile(user);
  return profile?.role ? normalizeRole(profile.role) : DEFAULT_ROLE;
}

export async function hasAnyRole(user, roles) {
  if (!user || !roles || !roles.length) return false;
  const profile = await getUserProfile(user);
  const role = profile?.role ? normalizeRole(profile.role) : DEFAULT_ROLE;
  return roles.map(normalizeRole).includes(role);
}

export async function hasCapability(user, capability) {
  if (!user || !capability) return false;
  const profile = await getUserProfile(user);
  const role = profile?.role ? normalizeRole(profile.role) : DEFAULT_ROLE;
  return ROLE_CAPABILITIES[role]?.includes(capability) || false;
}

export async function isAdminUser(user) {
  if (!user) return false;

  try {
    const tokenResult = await getIdTokenResult(user);
    if (tokenResult?.claims?.admin) {
      return true;
    }
  } catch (error) {
    console.warn('Admin token lookup failed:', error);
  }

  return hasAnyRole(user, [ROLES.admin]);
}

export async function isDeveloperUser(user) {
  if (!user) return false;
  return hasAnyRole(user, [ROLES.developer, ROLES.admin]);
}

export async function isApprovedDeveloper(user) {
  if (!user) return false;
  const profile = await getUserProfile(user);
  return Boolean(profile && (profile.role === ROLES.developer || profile.role === ROLES.admin) && profile.approved === true);
}

export async function isServiceProvider(user) {
  if (!user) return false;
  return hasAnyRole(user, [ROLES.service_provider, ROLES.admin]);
}

export async function isSalesEngineerAdmin(user) {
  if (!user) return false;
  return hasAnyRole(user, [ROLES.sales, ROLES.sales_engineer, ROLES.engineer, ROLES.admin]);
}

export async function isWorkforceUser(user) {
  if (!user) return false;
  return hasAnyRole(user, [ROLES.service_provider, ROLES.sales, ROLES.sales_engineer, ROLES.engineer, ROLES.admin]);
}
