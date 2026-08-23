"use client";

import { useState, useMemo } from "react";
import { Search, Menu, X, ChevronRight, Lightbulb, AlertTriangle, ListOrdered, User } from "lucide-react";
import { GUIDE_SECTIONS } from "./data";

export function GuideContent() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSection, setActiveSection] = useState(GUIDE_SECTIONS[0].id);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(GUIDE_SECTIONS.map((s) => s.id))
  );

  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return GUIDE_SECTIONS;
    const query = searchQuery.toLowerCase();
    return GUIDE_SECTIONS.filter(
      (section) =>
        section.title.toLowerCase().includes(query) ||
        section.subsections.some(
          (sub) =>
            sub.title.toLowerCase().includes(query) ||
            sub.content?.toLowerCase().includes(query) ||
            sub.steps?.some((s) => s.toLowerCase().includes(query)) ||
            sub.tips?.some((s) => s.toLowerCase().includes(query))
        )
    ).map((section) => ({
      ...section,
      subsections: section.subsections.filter(
        (sub) =>
          sub.title.toLowerCase().includes(query) ||
          sub.content?.toLowerCase().includes(query) ||
          sub.steps?.some((s) => s.toLowerCase().includes(query)) ||
          sub.tips?.some((s) => s.toLowerCase().includes(query)) ||
          section.title.toLowerCase().includes(query)
      ),
    })).filter((s) => s.subsections.length > 0);
  }, [searchQuery]);

  const currentSection = GUIDE_SECTIONS.find((s) => s.id === activeSection) || GUIDE_SECTIONS[0];

  const toggleExpanded = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const handleSectionClick = (sectionId: string) => {
    setActiveSection(sectionId);
    setSidebarOpen(false);
    if (searchQuery) setSearchQuery("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubsectionClick = (sectionId: string, subsectionId: string) => {
    setActiveSection(sectionId);
    setSidebarOpen(false);
    if (searchQuery) setSearchQuery("");
    setTimeout(() => {
      const element = document.getElementById(subsectionId);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 100);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Mobile Header */}
      <div className="lg:hidden sticky top-0 z-40 bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-lg hover:bg-slate-100"
        >
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
        <h1 className="font-bold text-slate-900">User Guide</h1>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={`fixed lg:sticky top-0 lg:top-16 left-0 h-screen lg:h-[calc(100vh-4rem)] w-80 bg-white border-r border-slate-200 overflow-hidden z-30 transition-transform ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          }`}
        >
          <div className="h-full flex flex-col">
            <div className="p-4 border-b border-slate-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search guide..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>
            </div>

            <nav className="flex-1 overflow-y-auto p-2">
              {filteredSections.map((section) => (
                <div key={section.id} className="mb-1">
                  <button
                    onClick={() => {
                      handleSectionClick(section.id);
                      toggleExpanded(section.id);
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                      activeSection === section.id
                        ? "bg-amber-50 text-amber-900"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span className="text-base">{section.icon}</span>
                    <span className="flex-1 text-left">{section.title}</span>
                    <ChevronRight
                      className={`h-4 w-4 transition-transform ${
                        expandedSections.has(section.id) ? "rotate-90" : ""
                      }`}
                    />
                  </button>

                  {expandedSections.has(section.id) && (
                    <div className="ml-6 mt-1 space-y-0.5">
                      {section.subsections.map((sub) => (
                        <button
                          key={sub.id}
                          onClick={() => handleSubsectionClick(section.id, sub.id)}
                          className="w-full text-left px-3 py-1.5 rounded text-xs text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                        >
                          {sub.title}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {filteredSections.length === 0 && (
                <div className="text-center py-8 text-sm text-slate-500">
                  No results found
                </div>
              )}
            </nav>
          </div>
        </aside>

        {/* Backdrop for mobile */}
        {sidebarOpen && (
          <div
            className="lg:hidden fixed inset-0 bg-black/30 z-20"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main Content */}
        <main className="flex-1 min-w-0 lg:ml-0">
          <div className="max-w-4xl mx-auto p-6 lg:p-10">
            {/* Section Header */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-4xl">{currentSection.icon}</span>
                <h1 className="text-3xl font-bold text-slate-900">
                  {currentSection.title}
                </h1>
              </div>
              <div className="h-1 w-24 bg-gradient-to-r from-amber-500 to-amber-600 rounded-full" />
            </div>

            {/* Subsections */}
            <div className="space-y-8">
              {currentSection.subsections.map((sub) => (
                <section
                  key={sub.id}
                  id={sub.id}
                  className="scroll-mt-20 bg-white rounded-xl border border-slate-200 p-6 shadow-sm"
                >
                  <h2 className="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
                    {sub.title}
                  </h2>

                  {sub.roles && sub.roles.length > 0 && (
                    <div className="mb-4 flex items-center gap-2 text-xs text-slate-600">
                      <User className="h-3.5 w-3.5" />
                      <span>Available to: {sub.roles.join(", ")}</span>
                    </div>
                  )}

                  {sub.content && (
                    <p className="text-slate-700 leading-relaxed mb-4">{sub.content}</p>
                  )}

                  {sub.steps && sub.steps.length > 0 && (
                    <div className="mb-4">
                      <h3 className="text-sm font-semibold text-slate-900 mb-2 flex items-center gap-2">
                        <ListOrdered className="h-4 w-4 text-amber-600" />
                        Steps
                      </h3>
                      <ol className="space-y-2 ml-6">
                        {sub.steps.map((step, idx) => (
                          <li key={idx} className="text-sm text-slate-700 list-decimal">
                            {step}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {sub.tips && sub.tips.length > 0 && (
                    <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h3 className="text-sm font-semibold text-blue-900 mb-2 flex items-center gap-2">
                        <Lightbulb className="h-4 w-4" />
                        Tips
                      </h3>
                      <ul className="space-y-1.5 ml-6">
                        {sub.tips.map((tip, idx) => (
                          <li key={idx} className="text-sm text-blue-800 list-disc">
                            {tip}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {sub.warnings && sub.warnings.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                      <h3 className="text-sm font-semibold text-amber-900 mb-2 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        Important
                      </h3>
                      <ul className="space-y-1.5 ml-6">
                        {sub.warnings.map((warning, idx) => (
                          <li key={idx} className="text-sm text-amber-800 list-disc">
                            {warning}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </section>
              ))}
            </div>

            {/* Navigation Footer */}
            <div className="mt-12 pt-6 border-t border-slate-200 flex items-center justify-between">
              <button
                onClick={() => {
                  const currentIdx = GUIDE_SECTIONS.findIndex((s) => s.id === activeSection);
                  if (currentIdx > 0) {
                    handleSectionClick(GUIDE_SECTIONS[currentIdx - 1].id);
                  }
                }}
                disabled={GUIDE_SECTIONS.findIndex((s) => s.id === activeSection) === 0}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ← Previous Section
              </button>
              <button
                onClick={() => {
                  const currentIdx = GUIDE_SECTIONS.findIndex((s) => s.id === activeSection);
                  if (currentIdx < GUIDE_SECTIONS.length - 1) {
                    handleSectionClick(GUIDE_SECTIONS[currentIdx + 1].id);
                  }
                }}
                disabled={
                  GUIDE_SECTIONS.findIndex((s) => s.id === activeSection) ===
                  GUIDE_SECTIONS.length - 1
                }
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next Section →
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
