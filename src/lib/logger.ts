import { collection, addDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';

export async function logActivity(action: string, details: string) {
  const user = auth.currentUser;
  if (!user) return;

  try {
    await addDoc(collection(db, 'activity_logs'), {
      userId: user.uid,
      userName: user.displayName || user.email || 'Unknown User',
      action,
      details,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Failed to log activity:', err);
  }
}
