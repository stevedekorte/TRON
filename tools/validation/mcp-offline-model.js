// Pin the original model and its conversion for repeatable MCP comparisons.
export const MCP_VOICE_MODEL={id:'onnx-community/chatterbox-ONNX',revision:'3cab09af388d3f02bba43443fce88c1f4525ac43',sampleRateHz:24000,exaggeration:.3,maxNewTokens:350};
export const mcpVoiceDtype=device=>({embed_tokens:'fp32',speech_encoder:'fp32',model:device==='webgpu'?'q4f16':'q4',language_model:device==='webgpu'?'q4f16':'q4',conditional_decoder:'fp32'});

// Exact file sizes for this pinned WebGPU revision; also avoid generic model.onnx discovery.
export const MCP_VOICE_FILES={
 "tokenizer_config.json": 244,
 "tokenizer.json": 28543,
 "config.json": 1097,
 "generation_config.json": 93,
 "onnx/embed_tokens.onnx": 13286,
 "onnx/embed_tokens.onnx_data": 61640704,
 "onnx/speech_encoder.onnx": 1184608,
 "onnx/speech_encoder.onnx_data": 591274880,
 "onnx/language_model_q4f16.onnx": 229388,
 "onnx/language_model_q4f16.onnx_data": 304737408,
 "onnx/conditional_decoder.onnx": 6350448,
 "onnx/conditional_decoder.onnx_data": 533970816
};
