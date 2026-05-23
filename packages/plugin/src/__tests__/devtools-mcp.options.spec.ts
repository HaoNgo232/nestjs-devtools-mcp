describe('DevtoolsMcpOptions surface area', () => {
  it('does not expose captureRequestBody option', () => {
    // Import compile-time check: option phải bị xóa khỏi type
    const sampleOptions: import('../devtools-mcp.options').DevtoolsMcpOptions = {}
    // @ts-expect-error - captureRequestBody must not exist on type
    sampleOptions.captureRequestBody = true
  })
})
