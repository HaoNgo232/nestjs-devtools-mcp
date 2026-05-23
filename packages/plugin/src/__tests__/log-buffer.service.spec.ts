import { Test, TestingModule } from '@nestjs/testing'
import { LogBufferService } from '../log-buffer.service'
import { DEVTOOLS_OPTIONS_TOKEN } from '../devtools-mcp.options'

/**
 * Unit test cho LogBufferService nhằm đảm bảo:
 * 1. Log được lưu chính xác.
 * 2. Cơ chế circular buffer (giới hạn kích thước) hoạt động đúng.
 * 3. Lọc log theo level hoạt động đúng.
 */
describe('LogBufferService', () => {
  let service: LogBufferService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LogBufferService,
        {
          provide: DEVTOOLS_OPTIONS_TOKEN,
          useValue: { logBufferSize: 3 }, // Dùng buffer nhỏ (3) để test tràn
        },
      ],
    }).compile()

    service = module.get<LogBufferService>(LogBufferService)
  })

  it('phải thêm được log entry vào buffer', () => {
    service.add({ level: 'log', message: 'Test message 1' })
    const logs = service.getLogs()
    expect(logs.length).toBe(1)
    expect(logs[0].message).toBe('Test message 1')
  })

  it('phải hoạt động như một circular buffer khi đầy', () => {
    // Fill buffer (size 3)
    service.add({ level: 'log', message: '1' })
    service.add({ level: 'log', message: '2' })
    service.add({ level: 'log', message: '3' })

    expect(service.getLogs().length).toBe(3)

    // Thêm log thứ 4 -> log '1' phải bị loại bỏ
    service.add({ level: 'log', message: '4' })
    const logs = service.getLogs()

    expect(logs.length).toBe(3)
    expect(logs[0].message).toBe('2') // '2' giờ là log cũ nhất
    expect(logs[2].message).toBe('4') // '4' là log mới nhất
  })

  it('phải lọc được log theo level (all vs specific)', () => {
    service.add({ level: 'log', message: 'L1' })
    service.add({ level: 'error', message: 'E1' })
    service.add({ level: 'warn', message: 'W1' })

    expect(service.getLogs(10, 'all').length).toBe(3)
    expect(service.getLogs(10, 'error').length).toBe(1)
    expect(service.getLogs(10, 'error')[0].message).toBe('E1')
    expect(service.getLogs(10, 'verbose').length).toBe(0)
  })

  it('phải giới hạn được số lượng log trả về (lines parameter)', () => {
    service.add({ level: 'log', message: '1' })
    service.add({ level: 'log', message: '2' })
    service.add({ level: 'log', message: '3' })

    const logs = service.getLogs(2)
    expect(logs).toHaveLength(2)
    expect(logs[0].message).toBe('2')
  })

  it('phải trả về mảng rỗng nếu không có log nào khớp với level yêu cầu', () => {
    service.add({ level: 'log', message: '1' })
    const errorLogs = service.getLogs(50, 'error')
    expect(errorLogs).toHaveLength(0)
  })

  it('nên sử dụng số dòng mặc định là 50 nếu không truyền tham số lines', () => {
    // Tạo instance mới với maxSize lớn hơn (100) để test việc lấy 50 dòng mặc định
    const serviceLarge = new LogBufferService({ logBufferSize: 100 } as any)
    for (let i = 0; i < 60; i++) {
      serviceLarge.add({ level: 'log', message: `msg ${i}` })
    }
    expect(serviceLarge.getLogs()).toHaveLength(50)
  })

  it('phải lọc được log theo requestId', () => {
    service.add({ level: 'log', message: 'L1', requestId: 'req-1' })
    service.add({ level: 'log', message: 'L2', requestId: 'req-2' })
    service.add({ level: 'log', message: 'L3', requestId: null })

    const logsReq1 = service.getLogs(10, 'all', 'req-1')
    expect(logsReq1).toHaveLength(1)
    expect(logsReq1[0].message).toBe('L1')

    const logsNull = service.getLogs(10, 'all', null)
    expect(logsNull).toHaveLength(1)
    expect(logsNull[0].message).toBe('L3')
  })

  describe('mặc định (default constructor values)', () => {
    it('nên sử dụng kích thước buffer mặc định là 500 nếu cấu hình logBufferSize bị thiếu', () => {
      const serviceDefault = new LogBufferService({} as any)
      expect(serviceDefault.getStats().bufferSize).toBe(500)
    })
  })
})
