/**
 * 房间系统工具函数
 */

/** 生成 6 位随机房间码（大写字母+数字） */
export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // 去掉易混淆字符 (0/O, 1/I)
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

/** 生成随机用户 ID */
export function generateUserId(): string {
  return `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/** 从 URL 参数中提取房间码 */
export function getRoomFromURL(): string | null {
  const params = new URLSearchParams(window.location.search)
  return params.get('room')
}
