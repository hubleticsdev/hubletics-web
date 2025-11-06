'use client';

import { useState } from 'react';
import { UploadButton } from '@/lib/uploadthing';
import { toast } from 'sonner';
import type { CoachProfileData } from '@/actions/onboarding/coach';

type Step3Props = {
  formData: CoachProfileData;
  setFormData: (data: CoachProfileData) => void;
};

type CertificationForm = {
  name: string;
  org: string;
  issueDate: string;
  expDate: string;
  fileUrl: string;
};

export function Step3Certifications({ formData, setFormData }: Step3Props) {
  const [isAdding, setIsAdding] = useState(false);
  const [currentCert, setCurrentCert] = useState<CertificationForm>({
    name: '',
    org: '',
    issueDate: '',
    expDate: '',
    fileUrl: '',
  });
  const [uploadingCert, setUploadingCert] = useState(false);

  const saveCertification = () => {
    if (!currentCert.name.trim()) {
      toast.error('Please enter certification name');
      return;
    }
    if (!currentCert.org.trim()) {
      toast.error('Please enter issuing organization');
      return;
    }
    if (!currentCert.issueDate) {
      toast.error('Please select issue date');
      return;
    }
    if (!currentCert.fileUrl) {
      toast.error('Please upload certification document');
      return;
    }

    // Add to form data
    setFormData({
      ...formData,
      certifications: [
        ...formData.certifications,
        {
          name: currentCert.name,
          org: currentCert.org,
          issueDate: currentCert.issueDate,
          expDate: currentCert.expDate || undefined,
          fileUrl: currentCert.fileUrl,
        },
      ],
    });

    // Reset form
    setCurrentCert({
      name: '',
      org: '',
      issueDate: '',
      expDate: '',
      fileUrl: '',
    });
    setIsAdding(false);
    toast.success('Certification added!');
  };

  const removeCertification = (index: number) => {
    setFormData({
      ...formData,
      certifications: formData.certifications.filter((_, i) => i !== index),
    });
    toast.success('Certification removed');
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Certifications & Credentials</h2>
        <p className="mt-2 text-gray-600">
          Add your coaching certifications to build trust with athletes. This step is optional but highly recommended.
        </p>
      </div>

      {/* Existing Certifications */}
      {formData.certifications.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Your Certifications</h3>
          {formData.certifications.map((cert, index) => (
            <div
              key={index}
              className="border-2 border-gray-200 rounded-lg p-4 flex items-start justify-between gap-4"
            >
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900">{cert.name}</h4>
                <p className="text-sm text-gray-600 mt-1">{cert.org}</p>
                <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                  <span>Issued: {new Date(cert.issueDate).toLocaleDateString()}</span>
                  {cert.expDate && (
                    <span>Expires: {new Date(cert.expDate).toLocaleDateString()}</span>
                  )}
                </div>
                <a
                  href={cert.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-[#FF6B4A] hover:text-[#FF8C5A] mt-2"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M8 4a3 3 0 00-3 3v4a5 5 0 0010 0V7a1 1 0 112 0v4a7 7 0 11-14 0V7a5 5 0 0110 0v4a3 3 0 11-6 0V7a1 1 0 012 0v4a1 1 0 102 0V7a3 3 0 00-3-3z"
                      clipRule="evenodd"
                    />
                  </svg>
                  View Document
                </a>
              </div>
              <button
                type="button"
                onClick={() => removeCertification(index)}
                className="text-red-500 hover:text-red-700 transition-colors"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add New Certification */}
      {isAdding ? (
        <div className="border-2 border-orange-200 rounded-lg p-6 bg-orange-50/30 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Add Certification</h3>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Certification Name
            </label>
            <input
              type="text"
              value={currentCert.name}
              onChange={(e) => setCurrentCert({ ...currentCert, name: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-[#FF6B4A] focus:outline-none focus:ring-2 focus:ring-[#FF6B4A]/20 transition-colors"
              placeholder="e.g., NASM Certified Personal Trainer"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Issuing Organization
            </label>
            <input
              type="text"
              value={currentCert.org}
              onChange={(e) => setCurrentCert({ ...currentCert, org: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-[#FF6B4A] focus:outline-none focus:ring-2 focus:ring-[#FF6B4A]/20 transition-colors"
              placeholder="e.g., National Academy of Sports Medicine"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Issue Date
              </label>
              <input
                type="date"
                value={currentCert.issueDate}
                onChange={(e) =>
                  setCurrentCert({ ...currentCert, issueDate: e.target.value })
                }
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-[#FF6B4A] focus:outline-none focus:ring-2 focus:ring-[#FF6B4A]/20 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Expiration Date (Optional)
              </label>
              <input
                type="date"
                value={currentCert.expDate}
                onChange={(e) =>
                  setCurrentCert({ ...currentCert, expDate: e.target.value })
                }
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-[#FF6B4A] focus:outline-none focus:ring-2 focus:ring-[#FF6B4A]/20 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-3">
              Upload Certificate (PDF)
            </label>
            {currentCert.fileUrl ? (
              <div className="relative p-4 bg-green-50 border-2 border-green-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <svg className="w-10 h-10 text-green-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v3.586l-1.293-1.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V8z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-green-800">Certificate uploaded successfully!</p>
                    <a
                      href={currentCert.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-green-700 hover:text-green-900 mt-1 underline"
                    >
                      Preview PDF
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentCert({ ...currentCert, fileUrl: '' });
                      toast.success('Certificate removed. Upload a new one below.');
                    }}
                    className="p-1.5 text-green-600 hover:text-green-800 hover:bg-green-100 rounded transition-colors"
                    title="Remove file"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            ) : uploadingCert ? (
              <div className="flex items-center gap-3 p-4 bg-orange-50 border-2 border-orange-200 rounded-lg">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-orange-500 border-t-transparent"></div>
                <span className="text-sm font-medium text-orange-700">Uploading certificate...</span>
              </div>
            ) : (
              <UploadButton
                endpoint="coachCertification"
                onClientUploadComplete={(res) => {
                  if (res?.[0]?.url) {
                    setCurrentCert({ ...currentCert, fileUrl: res[0].url });
                    toast.success('Certificate uploaded!');
                  }
                  setUploadingCert(false);
                }}
                onUploadError={(error: Error) => {
                  toast.error(`Upload failed: ${error.message}`);
                  setUploadingCert(false);
                }}
                onUploadBegin={() => setUploadingCert(true)}
                disabled={uploadingCert}
                appearance={{
                  button:
                    'ut-ready:bg-gradient-to-r ut-ready:from-[#FF6B4A] ut-ready:to-[#FF8C5A] ut-uploading:cursor-not-allowed ut-ready:cursor-pointer ut-uploading:bg-gray-400 ut-button:text-white ut-button:font-semibold ut-button:rounded-lg ut-button:px-4 ut-button:py-2',
                  container: 'flex items-center',
                  allowedContent: 'text-xs text-gray-500 mt-2',
                }}
                content={{
                  button({ ready, isUploading }) {
                    if (isUploading) return 'Uploading...';
                    if (ready) return 'Upload PDF';
                    return 'Getting ready...';
                  },
                }}
              />
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={saveCertification}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-[#FF6B4A] to-[#FF8C5A] text-white font-semibold rounded-lg hover:shadow-lg transition-all"
            >
              Save Certification
            </button>
            <button
              type="button"
              onClick={() => {
                setIsAdding(false);
                setCurrentCert({
                  name: '',
                  org: '',
                  issueDate: '',
                  expDate: '',
                  fileUrl: '',
                });
              }}
              className="px-6 py-3 bg-white text-gray-700 font-medium rounded-lg border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          className="w-full px-6 py-4 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-[#FF6B4A] hover:text-[#FF6B4A] transition-all flex items-center justify-center gap-2 font-medium"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 6v6m0 0v6m0-6h6m-6 0H6"
            />
          </svg>
          Add Certification
        </button>
      )}

      {formData.certifications.length === 0 && !isAdding && (
        <div className="text-center py-6 px-4 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg">
          <p className="text-gray-600">
            No certifications added yet. While optional, certifications help build trust with athletes.
          </p>
        </div>
      )}
    </div>
  );
}

