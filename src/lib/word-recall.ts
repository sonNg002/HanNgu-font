export interface WordRecall {
  queue: number[];
  total: number;
  mistakes: number[];
}

export function startWordRecall(total: number, shuffle: boolean, random = Math.random): WordRecall {
  const queue = Array.from({ length: total }, (_, index) => index);
  // Fisher–Yates đổi thứ tự, không thêm/bỏ từ; chỉ chạy khi người học bắt đầu lượt.
  if (shuffle) for (let index = queue.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [queue[index], queue[other]] = [queue[other], queue[index]];
  }
  return { queue, total, mistakes: [] };
}

export function gradeWordRecall(session: WordRecall, known: boolean): WordRecall {
  if (!session.queue.length) return session;
  const [current, ...rest] = session.queue;
  // Lưu mỗi từ khó một lần; trả lời sai quay lại cuối hàng đợi, không giả định đã thuộc.
  return { ...session, queue: known ? rest : [...rest, current],
    mistakes: known || session.mistakes.includes(current) ? session.mistakes : [...session.mistakes, current] };
}

export function retryWordRecall(session: WordRecall, shuffle: boolean, random = Math.random): WordRecall {
  // Giữ chỉ số trong nhóm gốc để từ khó ở vị trí 2/4 không biến thành từ 0/1.
  const order = startWordRecall(session.mistakes.length, shuffle, random);
  return { ...order, queue: order.queue.map(index => session.mistakes[index]) };
}

export function selectedWordRecall(total: number, selected: number[], shuffle: boolean): WordRecall {
  // Chỉ nhận chỉ số thuộc nhóm hiện tại; loại trùng để bộ đếm không tăng sai.
  const indices = [...new Set(selected)].filter(index => Number.isInteger(index) && index >= 0 && index < total);
  const order = startWordRecall(indices.length, shuffle);
  return { ...order, queue: order.queue.map(index => indices[index]) };
}
