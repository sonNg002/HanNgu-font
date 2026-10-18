import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { CourseLibrary } from '@/components/course-library';
import type { Content } from '@/lib/types';
export const dynamic = 'force-static';
// Dùng kho chữ build sẵn để bộ học hoạt động offline, không đọc Firebase.
export default async function Courses() {
  const content = JSON.parse(await readFile(path.join(process.cwd(), 'public/data/content.json'), 'utf8')) as Content;
  return <CourseLibrary characters={content.characters} />;
}
