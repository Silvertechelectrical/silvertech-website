import { db } from './firebase-init.js';
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
  managing_director: 'managing_director',
  sales_ops_manager: 'sales_ops_manager',
  sales_associate: 'sales_associate',
  engineering_lead: 'engineering_lead',
  field_technician: 'field_technician',
  junior_technician: 'junior_technician',
  digital_lead: 'digital_lead',
  developer: 'developer',
  it_support: 'it_support'
};

export const ROLE_CAPABILITIES = {
  [ROLES.guest]: ['browse'],
  [ROLES.user]: ['browse', 'purchase', 'request_service'],
  [ROLES.managing_director]: ['manage_users', 'manage_services', 'manage_store', 'browse', 'access_dashboard', 'approve_projects'],
  [ROLES.sales_ops_manager]: ['quote', 'manage_procurement', 'manage_projects', 'browse'],
  [ROLES.sales_associate]: ['lead_generation', 'book_site_visits', 'browse'],
  [ROLES.engineering_lead]: ['assign_techs', 'qa', 'browse'],
  [ROLES.field_technician]: ['execute_install', 'browse'],
  [ROLES.junior_technician]: ['assist_install', 'browse'],
  [ROLES.digital_lead]: ['manage_projects', 'code_review', 'browse'],
  [ROLES.developer]: ['upload_store_assets', 'code', 'browse'],
  [ROLES.it_support]: ['it_support', 'browse']
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
      position: '',
      permissions: [],
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
      if (existingProfile.position) {
        profile.position = existingProfile.position;
      }
      if (Array.isArray(existingProfile.permissions)) {
        profile.permissions = existingProfile.permissions;
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
  const roleCaps = ROLE_CAPABILITIES[role] || [];
  const explicitPermissions = Array.isArray(profile?.permissions) ? profile.permissions : [];
  return roleCaps.includes(capability) || explicitPermissions.includes(capability);
}

export async function isAdminUser(user) {
  if (!user) {
    console.debug('[role-utils] isAdminUser: user is null/undefined');
    return false;
  }

  try {
    const tokenResult = await getIdTokenResult(user);
    if (tokenResult?.claims?.admin) {
      console.debug('[role-utils] isAdminUser: ✓ Found admin claim in token');
      return true;
    } else {
      console.debug('[role-utils] isAdminUser: Token has no admin claim');
    }
  } catch (error) {
    console.warn('[role-utils] Admin token lookup failed:', error);
  }

  // Fall back to role check
  const hasAdminRole = await hasAnyRole(user, [ROLES.managing_director]);
  console.debug(`[role-utils] isAdminUser: hasAnyRole(managing_director) = ${hasAdminRole}`);
  
  if (hasAdminRole) {
    console.debug('[role-utils] isAdminUser: ✓ User has admin role');
    return true;
  }
  
  console.debug('[role-utils] isAdminUser: ✗ User is NOT admin');
  return false;
}

export async function isDeveloperUser(user) {
  if (!user) return false;
  return hasAnyRole(user, [ROLES.developer, ROLES.digital_lead, ROLES.managing_director]);
}

export async function isApprovedDeveloper(user) {
  if (!user) return false;
  const profile = await getUserProfile(user);
  return Boolean(profile && (profile.role === ROLES.developer || profile.role === ROLES.digital_lead || profile.role === ROLES.managing_director) && profile.approved === true);
}

export async function isServiceProvider(user) {
  if (!user) return false;
  return hasAnyRole(user, [ROLES.field_technician, ROLES.engineering_lead, ROLES.managing_director]);
}

export async function isSalesEngineerAdmin(user) {
  if (!user) return false;
  // Combine sales and engineering leadership roles
  return hasAnyRole(user, [ROLES.sales_ops_manager, ROLES.sales_associate, ROLES.engineering_lead, ROLES.managing_director]);
}

export async function isWorkforceUser(user) {
  if (!user) return false;
  return hasAnyRole(user, [ROLES.field_technician, ROLES.junior_technician, ROLES.sales_ops_manager, ROLES.sales_associate, ROLES.engineering_lead, ROLES.managing_director]);
}
