import { Injectable, Inject } from '@nestjs/common';
import { DEVTOOLS_OPTIONS_TOKEN, DevtoolsMcpOptions } from './devtools-mcp.options';

export interface LogEntry {
  timestamp: number;
  level: 'log' | 'error' | 'warn' | 'debug' | 'verbose';
  message: string;
  context?: string;
  trace?: string;
}

@Injectable()
export class LogBufferService {
  private readonly buffer: LogEntry[] = [];
  private readonly maxSize: number;

  constructor(
    @Inject(DEVTOOLS_OPTIONS_TOKEN)
    private readonly options: DevtoolsMcpOptions,
  ) {
    this.maxSize = options.logBufferSize || 500;
  }

  /**
   * Thêm một log mới vào circular buffer
   * @param entry Đối tượng log chứa thông tin về level, message, context và trace
   */
  add(entry: Omit<LogEntry, 'timestamp'>) {
    const logEntry: LogEntry = {
      ...entry,
      timestamp: Date.now(),
    };

    if (this.buffer.length >= this.maxSize) {
      this.buffer.shift(); // Loại bỏ phần tử cũ nhất nếu buffer đầy
    }
    this.buffer.push(logEntry);
  }

  /**
   * Lấy danh sách log từ buffer dựa trên các tiêu chí lọc
   * @param lines Số dòng log tối đa muốn lấy
   * @param level Filter theo level log
   * @returns Danh sách các log entry
   */
  getLogs(lines = 50, level: string = 'all'): LogEntry[] {
    let filtered = this.buffer;
    if (level !== 'all') {
      filtered = this.buffer.filter(e => e.level === level);
    }
    return filtered.slice(-lines);
  }

  /**
   * Trả về thông tin meta về trạng thái của buffer
   */
  getStats() {
    return {
      total: this.buffer.length,
      bufferSize: this.maxSize,
    };
  }
}
