import React, { useState, useRef } from 'react';
import { Plus, Sparkles, Upload, FileVideo, RefreshCw, AlertTriangle, ListPlus } from 'lucide-react';
import { InputType, VideoModel, AspectRatio, Resolution, VideoJob } from '../types';
import { fileToBase64 } from '../utils/file';

interface CreateJobFormProps {
  onAddJobs: (jobs: Omit<VideoJob, 'id' | 'status' | 'progress' | 'createdAt'>[]) => void;
  hasApiKey: boolean;
}

export default function CreateJobForm({ onAddJobs, hasApiKey }: CreateJobFormProps) {
  const [activeTab, setActiveTab] = useState<'single' | 'bulk'>('single');

  // Single job state
  const [prompt, setPrompt] = useState('');
  const [inputType, setInputType] = useState<InputType>('text');
  const [model, setModel] = useState<VideoModel>('veo-3.1-lite-generate-preview');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [resolution, setResolution] = useState<Resolution>('720p');
  const [outputs, setOutputs] = useState<number>(1);
  const [image, setImage] = useState<string>('');
  const [lastFrame, setLastFrame] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileInputLastRef = useRef<HTMLInputElement>(null);

  // Bulk job state
  const [bulkPrompts, setBulkPrompts] = useState('');
  const [bulkInputType, setBulkInputType] = useState<InputType>('text');
  const [bulkModel, setBulkModel] = useState<VideoModel>('veo-3.1-lite-generate-preview');
  const [bulkAspectRatio, setBulkAspectRatio] = useState<AspectRatio>('16:9');
  const [bulkResolution, setBulkResolution] = useState<Resolution>('720p');
  const [bulkOutputs, setBulkOutputs] = useState<number>(1);
  const [bulkImage, setBulkImage] = useState<string>('');
  const [bulkLastFrame, setBulkLastFrame] = useState<string>('');

  const bulkFileInputRef = useRef<HTMLInputElement>(null);
  const bulkFileInputLastRef = useRef<HTMLInputElement>(null);

  // Load sample prompts
  const loadSamples = () => {
    const samples = [
      "Một phi hành gia đang lướt ván trên vành đai sao Thổ, phong cách điện ảnh cinematic",
      "Cận cảnh một bông hồng pha lê tan chảy dưới ngọn lửa màu xanh lam, chuyển động chậm",
      "Thành phố Cyberpunk huyền ảo vào ban đêm dưới cơn mưa tầm tã, ánh đèn neon rực rỡ phản chiếu",
      "Chú mèo con đeo kính phi công đang lái một chiếc tàu lượn nhỏ qua các đám mây hồng hoàng hôn",
      "Thác nước dung nham phun trào đổ xuống lòng đại dương băng giá, khói bốc lên nghi ngút",
      "Một chú rùa biển phát quang sinh học bơi lội trong rừng san hô pha lê lấp lánh ở độ sâu nghìn mét",
      "Chân dung 3D cận cảnh một chú robot cổ điển rỉ sét đang tưới một bông hoa bồ công anh nhỏ",
      "Chiếc xe thể thao màu vàng chạy xuyên qua bão cát đỏ trên sa mạc sao Hỏa phẳng lặng",
      "Một con rồng vàng nhỏ đang nằm ngủ cuộn tròn trên đống tiền xu cổ lấp lánh ánh vàng",
      "Cảnh quay flycam từ trên cao lướt qua một ngôi đền cổ kính phủ đầy rêu phong ẩn trong sương mù"
    ];
    setBulkPrompts(samples.join('\n'));
  };

  // Convert uploaded image
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: 'start' | 'end', isBulk = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const base64 = await fileToBase64(file);
      if (isBulk) {
        if (target === 'start') setBulkImage(base64);
        else setBulkLastFrame(base64);
      } else {
        if (target === 'start') setImage(base64);
        else setLastFrame(base64);
      }
    } catch (err) {
      console.error("Lỗi đọc file ảnh:", err);
      alert("Không thể đọc file ảnh. Vui lòng thử lại!");
    }
  };

  const handleSingleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) {
      alert("Vui lòng nhập Prompt mô tả video!");
      return;
    }

    const newJobs = Array.from({ length: outputs }).map(() => ({
      prompt: prompt.trim(),
      inputType,
      model,
      aspectRatio,
      resolution,
      outputs: 1, // Store as single outputs per job in the queue
      image: inputType !== 'text' ? image : undefined,
      lastFrame: inputType === 'frame' ? lastFrame : undefined
    }));

    onAddJobs(newJobs);
    
    // Reset form but keep configuration for ease of next entry
    setPrompt('');
    setImage('');
    setLastFrame('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (fileInputLastRef.current) fileInputLastRef.current.value = '';
  };

  const handleBulkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkPrompts.trim()) {
      alert("Vui lòng nhập hoặc tải danh sách Prompt!");
      return;
    }

    const promptsList = bulkPrompts
      .split('\n')
      .map(p => p.trim())
      .filter(p => p.length > 0);

    if (promptsList.length === 0) {
      alert("Không tìm thấy prompt hợp lệ nào!");
      return;
    }

    const newJobs: Omit<VideoJob, 'id' | 'status' | 'progress' | 'createdAt'>[] = [];

    promptsList.forEach(p => {
      // Create N jobs for each prompt if output count is set > 1
      for (let i = 0; i < bulkOutputs; i++) {
        newJobs.push({
          prompt: p,
          inputType: bulkInputType,
          model: bulkModel,
          aspectRatio: bulkAspectRatio,
          resolution: bulkResolution,
          outputs: 1,
          image: bulkInputType !== 'text' ? bulkImage : undefined,
          lastFrame: bulkInputType === 'frame' ? bulkLastFrame : undefined
        });
      }
    });

    onAddJobs(newJobs);
    
    // Reset state
    setBulkPrompts('');
    setBulkImage('');
    setBulkLastFrame('');
    if (bulkFileInputRef.current) bulkFileInputRef.current.value = '';
    if (bulkFileInputLastRef.current) bulkFileInputLastRef.current.value = '';
  };

  return (
    <div id="create-job-container" className="space-y-4">
      {/* High Density Tabs Header */}
      <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 shrink-0">
        <button
          id="tab-single-btn"
          type="button"
          onClick={() => setActiveTab('single')}
          className={`py-1.5 px-3 rounded flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-wider transition-all ${
            activeTab === 'single'
              ? 'text-white bg-indigo-600 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-3 h-3" />
          Đơn Lẻ
        </button>
        <button
          id="tab-bulk-btn"
          type="button"
          onClick={() => setActiveTab('bulk')}
          className={`py-1.5 px-3 rounded flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-wider transition-all ${
            activeTab === 'bulk'
              ? 'text-white bg-indigo-600 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <ListPlus className="w-3 h-3" />
          Hàng Loạt
          <span className="ml-1 px-1.5 py-0.2 text-[8px] bg-slate-900 border border-slate-800 rounded text-slate-300">
            20-50
          </span>
        </button>
      </div>

      <div className="space-y-4">
        {/* Single Mode Form */}
        {activeTab === 'single' && (
          <form id="single-job-form" onSubmit={handleSingleSubmit} className="space-y-4">
            <div>
              <label htmlFor="single-prompt" className="text-[10px] uppercase text-slate-400 font-bold mb-1.5 block tracking-wider">
                Nội dung mô tả (Prompt)
              </label>
              <textarea
                id="single-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Mô tả video cần tạo (Ví dụ: Một phi hành gia cưỡi ngựa trên sa mạc sao hoả, phong cách điện ảnh...)"
                rows={3}
                className="w-full bg-[#1E293B] border border-slate-700 rounded p-2 text-xs text-slate-200 placeholder-slate-500 focus:border-indigo-500 outline-none resize-none"
              />
            </div>

            {/* Dense Config Fields Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="single-input-type" className="text-[10px] uppercase text-slate-400 font-bold mb-1 block tracking-wider">
                  Đầu Vào (Input)
                </label>
                <select
                  id="single-input-type"
                  value={inputType}
                  onChange={(e) => {
                    setInputType(e.target.value as InputType);
                    setImage('');
                    setLastFrame('');
                  }}
                  className="w-full bg-[#1E293B] border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-indigo-500"
                >
                  <option value="text">Văn bản (Text)</option>
                  <option value="image">Hình ảnh (Image)</option>
                  <option value="frame">Khung hình (Frame)</option>
                </select>
              </div>

              <div>
                <label htmlFor="single-model" className="text-[10px] uppercase text-slate-400 font-bold mb-1 block tracking-wider">
                  Mô hình (Model)
                </label>
                <select
                  id="single-model"
                  value={model}
                  onChange={(e) => setModel(e.target.value as VideoModel)}
                  className="w-full bg-[#1E293B] border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-indigo-500"
                >
                  <option value="veo-3.1-lite-generate-preview">Veo 3.1 Lite</option>
                  <option value="veo-3.1-generate-preview">Veo 3.1 Pro</option>
                </select>
              </div>

              <div>
                <label htmlFor="single-ratio" className="text-[10px] uppercase text-slate-400 font-bold mb-1 block tracking-wider">
                  Tỉ lệ (Ratio)
                </label>
                <select
                  id="single-ratio"
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
                  className="w-full bg-[#1E293B] border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-indigo-500"
                >
                  <option value="16:9">Landscape 16:9</option>
                  <option value="9:16">Portrait 9:16</option>
                  <option value="1:1">Square 1:1</option>
                </select>
              </div>

              <div>
                <label htmlFor="single-outputs" className="text-[10px] uppercase text-slate-400 font-bold mb-1 block tracking-wider">
                  Số bản (Copies)
                </label>
                <input
                  id="single-outputs"
                  type="number"
                  min={1}
                  max={10}
                  value={outputs}
                  onChange={(e) => setOutputs(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full bg-[#1E293B] border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 outline-none focus:border-indigo-500 font-mono"
                />
              </div>
            </div>

            {/* Resolution Sub-Choice */}
            <div className="flex gap-4 text-[10px] border-t border-slate-800/80 pt-2 items-center">
              <span className="font-bold text-slate-500 uppercase tracking-wider">Độ phân giải:</span>
              <label className="flex items-center gap-1 text-slate-300 cursor-pointer">
                <input
                  type="radio"
                  name="single-res"
                  value="720p"
                  checked={resolution === '720p'}
                  onChange={() => setResolution('720p')}
                  className="accent-indigo-500"
                />
                720p
              </label>
              <label className="flex items-center gap-1 text-slate-300 cursor-pointer">
                <input
                  type="radio"
                  name="single-res"
                  value="1080p"
                  checked={resolution === '1080p'}
                  onChange={() => setResolution('1080p')}
                  className="accent-indigo-500"
                />
                1080p
              </label>
            </div>

            {/* Image Upload Area */}
            {inputType !== 'text' && (
              <div className="grid grid-cols-1 gap-2.5 border-t border-slate-800/80 pt-3">
                {/* Start Image */}
                <div className="p-2.5 bg-indigo-950/20 border border-indigo-900/30 rounded flex items-center justify-between">
                  <div>
                    <span className="block text-[10px] uppercase text-indigo-300 font-bold">Ảnh bắt đầu</span>
                    <span className="text-[9px] text-slate-500">Kéo thả hoặc tải lên file</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      id="upload-start-img-btn"
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-7 h-7 bg-indigo-900/50 hover:bg-indigo-900 text-indigo-300 rounded border border-indigo-500/30 flex items-center justify-center font-bold text-xs cursor-pointer transition"
                    >
                      +
                    </button>
                    <input
                      id="start-image-file"
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e, 'start')}
                      className="hidden"
                    />
                    {image && (
                      <div className="relative w-8 h-8 rounded overflow-hidden border border-indigo-500/30 bg-slate-950 shrink-0">
                        <img src={image} alt="Start frame" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setImage('')}
                          className="absolute inset-0 bg-black/70 opacity-0 hover:opacity-100 flex items-center justify-center text-[8px] text-red-400 font-bold transition"
                        >
                          Xóa
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* End Image (Frame to video) */}
                {inputType === 'frame' && (
                  <div className="p-2.5 bg-indigo-950/20 border border-indigo-900/30 rounded flex items-center justify-between">
                    <div>
                      <span className="block text-[10px] uppercase text-indigo-300 font-bold">Ảnh kết thúc</span>
                      <span className="text-[9px] text-slate-500">Dành cho Frame to Video</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        id="upload-end-img-btn"
                        type="button"
                        onClick={() => fileInputLastRef.current?.click()}
                        className="w-7 h-7 bg-indigo-900/50 hover:bg-indigo-900 text-indigo-300 rounded border border-indigo-500/30 flex items-center justify-center font-bold text-xs cursor-pointer transition"
                      >
                        +
                      </button>
                      <input
                        id="end-image-file"
                        ref={fileInputLastRef}
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageUpload(e, 'end')}
                        className="hidden"
                      />
                      {lastFrame && (
                        <div className="relative w-8 h-8 rounded overflow-hidden border border-indigo-500/30 bg-slate-950 shrink-0">
                          <img src={lastFrame} alt="End frame" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => setLastFrame('')}
                            className="absolute inset-0 bg-black/70 opacity-0 hover:opacity-100 flex items-center justify-center text-[8px] text-red-400 font-bold transition"
                          >
                            Xóa
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Add to list action */}
            <button
              id="add-single-job-btn"
              type="submit"
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 rounded text-xs font-bold text-white shadow-lg shadow-indigo-650/10 transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Thêm vào Hàng đợi
            </button>
          </form>
        )}

        {/* Bulk Mode Form */}
        {activeTab === 'bulk' && (
          <form id="bulk-job-form" onSubmit={handleBulkSubmit} className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label htmlFor="bulk-prompts" className="text-[10px] uppercase text-slate-400 font-bold block tracking-wider">
                  Bulk Prompt Entry (1 dòng/prompt)
                </label>
                <button
                  id="load-sample-prompts-btn"
                  type="button"
                  onClick={loadSamples}
                  className="text-[9px] text-indigo-400 hover:text-indigo-300 font-bold uppercase tracking-wider transition flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-2.5 h-2.5 animate-spin-hover" />
                  Mẫu
                </button>
              </div>
              <textarea
                id="bulk-prompts"
                value={bulkPrompts}
                onChange={(e) => setBulkPrompts(e.target.value)}
                placeholder="Nhập mỗi prompt một dòng (Ví dụ:&#10;A futuristic city in rain...&#10;An astronaut on Saturn rings...)"
                rows={5}
                className="w-full bg-[#1E293B] border border-slate-700 rounded p-2 text-xs text-slate-200 font-mono focus:border-indigo-500 outline-none resize-none leading-relaxed"
              />
            </div>

            {/* Bulk Config Dense Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="bulk-input-type" className="text-[10px] uppercase text-slate-400 font-bold mb-1 block tracking-wider">
                  Loại Đầu Vào
                </label>
                <select
                  id="bulk-input-type"
                  value={bulkInputType}
                  onChange={(e) => {
                    setBulkInputType(e.target.value as InputType);
                    setBulkImage('');
                    setBulkLastFrame('');
                  }}
                  className="w-full bg-[#1E293B] border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-indigo-500"
                >
                  <option value="text">Văn bản (Text)</option>
                  <option value="image">Hình ảnh (Image)</option>
                  <option value="frame">Khung hình (Frame)</option>
                </select>
              </div>

              <div>
                <label htmlFor="bulk-model" className="text-[10px] uppercase text-slate-400 font-bold mb-1 block tracking-wider">
                  Mô hình AI
                </label>
                <select
                  id="bulk-model"
                  value={bulkModel}
                  onChange={(e) => setBulkModel(e.target.value as VideoModel)}
                  className="w-full bg-[#1E293B] border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-indigo-500"
                >
                  <option value="veo-3.1-lite-generate-preview">Veo 3.1 Lite</option>
                  <option value="veo-3.1-generate-preview">Veo 3.1 Pro</option>
                </select>
              </div>

              <div>
                <label htmlFor="bulk-ratio" className="text-[10px] uppercase text-slate-400 font-bold mb-1 block tracking-wider">
                  Tỉ lệ (Ratio)
                </label>
                <select
                  id="bulk-ratio"
                  value={bulkAspectRatio}
                  onChange={(e) => setBulkAspectRatio(e.target.value as AspectRatio)}
                  className="w-full bg-[#1E293B] border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-indigo-500"
                >
                  <option value="16:9">Landscape 16:9</option>
                  <option value="9:16">Portrait 9:16</option>
                  <option value="1:1">Square 1:1</option>
                </select>
              </div>

              <div>
                <label htmlFor="bulk-outputs" className="text-[10px] uppercase text-slate-400 font-bold mb-1 block tracking-wider">
                  Số bản/Prompt
                </label>
                <input
                  id="bulk-outputs"
                  type="number"
                  min={1}
                  max={5}
                  value={bulkOutputs}
                  onChange={(e) => setBulkOutputs(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full bg-[#1E293B] border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 outline-none focus:border-indigo-500 font-mono"
                />
              </div>
            </div>

            {/* Resolution Sub-Choice */}
            <div className="flex gap-4 text-[10px] border-t border-slate-800/80 pt-2 items-center">
              <span className="font-bold text-slate-500 uppercase tracking-wider">Độ phân giải:</span>
              <label className="flex items-center gap-1 text-slate-300 cursor-pointer">
                <input
                  type="radio"
                  name="bulk-res"
                  value="720p"
                  checked={bulkResolution === '720p'}
                  onChange={() => setBulkResolution('720p')}
                  className="accent-indigo-500"
                />
                720p
              </label>
              <label className="flex items-center gap-1 text-slate-300 cursor-pointer">
                <input
                  type="radio"
                  name="bulk-res"
                  value="1080p"
                  checked={bulkResolution === '1080p'}
                  onChange={() => setBulkResolution('1080p')}
                  className="accent-indigo-500"
                />
                1080p
              </label>
            </div>

            {/* Bulk Image Upload Area */}
            {bulkInputType !== 'text' && (
              <div className="grid grid-cols-1 gap-2.5 border-t border-slate-800/80 pt-3">
                <div className="p-2.5 bg-indigo-950/20 border border-indigo-900/30 rounded flex items-center justify-between">
                  <div>
                    <span className="block text-[10px] uppercase text-indigo-300 font-bold">Ảnh bắt đầu (Hàng loạt)</span>
                    <span className="text-[9px] text-slate-500">Chung cho mọi dòng</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      id="bulk-upload-start-btn"
                      type="button"
                      onClick={() => bulkFileInputRef.current?.click()}
                      className="w-7 h-7 bg-indigo-900/50 hover:bg-indigo-900 text-indigo-300 rounded border border-indigo-500/30 flex items-center justify-center font-bold text-xs cursor-pointer transition"
                    >
                      +
                    </button>
                    <input
                      id="bulk-start-image-file"
                      ref={bulkFileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e, 'start', true)}
                      className="hidden"
                    />
                    {bulkImage && (
                      <div className="relative w-8 h-8 rounded overflow-hidden border border-indigo-500/30 bg-slate-950 shrink-0">
                        <img src={bulkImage} alt="Bulk Start frame" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setBulkImage('')}
                          className="absolute inset-0 bg-black/70 opacity-0 hover:opacity-100 flex items-center justify-center text-[8px] text-red-400 font-bold transition"
                        >
                          Xóa
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {bulkInputType === 'frame' && (
                  <div className="p-2.5 bg-indigo-950/20 border border-indigo-900/30 rounded flex items-center justify-between">
                    <div>
                      <span className="block text-[10px] uppercase text-indigo-300 font-bold">Ảnh kết thúc (Hàng loạt)</span>
                      <span className="text-[9px] text-slate-500">Chung cho mọi dòng</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        id="bulk-upload-end-btn"
                        type="button"
                        onClick={() => bulkFileInputLastRef.current?.click()}
                        className="w-7 h-7 bg-indigo-900/50 hover:bg-indigo-900 text-indigo-300 rounded border border-indigo-500/30 flex items-center justify-center font-bold text-xs cursor-pointer transition"
                      >
                        +
                      </button>
                      <input
                        id="bulk-end-image-file"
                        ref={bulkFileInputLastRef}
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageUpload(e, 'end', true)}
                        className="hidden"
                      />
                      {bulkLastFrame && (
                        <div className="relative w-8 h-8 rounded overflow-hidden border border-indigo-500/30 bg-slate-950 shrink-0">
                          <img src={bulkLastFrame} alt="Bulk End frame" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => setBulkLastFrame('')}
                            className="absolute inset-0 bg-black/70 opacity-0 hover:opacity-100 flex items-center justify-center text-[8px] text-red-400 font-bold transition"
                          >
                            Xóa
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Submit list action */}
            <div className="space-y-2 pt-1">
              <button
                id="add-bulk-jobs-btn"
                type="submit"
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 rounded text-xs font-bold text-white shadow-lg shadow-indigo-650/10 transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Thêm danh sách ({bulkPrompts.split('\n').filter(p => p.trim().length > 0).length * bulkOutputs} Jobs)
              </button>
              
              <div className="text-[9px] text-amber-500 text-center leading-normal">
                Tự động tách thành các job lẻ trong hàng đợi.
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
