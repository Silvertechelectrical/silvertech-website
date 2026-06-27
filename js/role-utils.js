import { db } from './firebase-init.js';
import { getIdTokenResult } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js';
import { collection, getDocs, query, where } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js';

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

  if (!db) return false;

  try {
    let snapshot = await getDocs(query(collection(db, 'users'), where('uid', '==', user.uid), where('role', '==', 'admin')));
    if (!snapshot.empty) return true;

    if (user.email) {
      snapshot = await getDocs(query(collection(db, 'users'), where('email', '==', user.email), where('role', '==', 'admin')));
      if (!snapshot.empty) return true;
    }
  } catch (error) {
    console.warn('Admin Firestore lookup failed:', error);
  }

  return false;
}

export async function isApprovedDeveloper(user) {
  if (!user || !db) return false;

  try {
    let snapshot = await getDocs(query(collection(db, 'developers'), where('uid', '==', user.uid)));
    if (!snapshot.empty) return true;

    if (user.email) {
      snapshot = await getDocs(query(collection(db, 'developers'), where('email', '==', user.email)));
      if (!snapshot.empty) return true;
    }
  } catch (error) {
    console.warn('Developer lookup failed:', error);
  }

  return false;
}
