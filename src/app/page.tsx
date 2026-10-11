import { LearningApp } from '@/components/learning-app';
// Trang học là client component; shell vẫn được export tĩnh để cache offline.
export default function Home() { return <LearningApp />; }