import { db } from "../firebase";
import { collection, addDoc, Timestamp } from "firebase/firestore";
import { getAuth } from "firebase/auth";

export const logTimestamp = async (label, start, end) => {
  const user = getAuth().currentUser;
  if (!user) throw new Error("User not logged in");

  const duration = (end - start) / 1000;

  await addDoc(collection(db, "timeLogs"), {
    uid: user.uid,
    label,
    start: Timestamp.fromDate(new Date(start)),
    end: Timestamp.fromDate(new Date(end)),
    duration,
    createdAt: Timestamp.now(),
  });
};
