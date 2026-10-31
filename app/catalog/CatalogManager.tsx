"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";

type Item = {
  id: string;
  code?: string;
  name?: string;
  [key: string]: string | number | null | undefined;
};

type Catalog = {
  languages: Item[];
  levels: Item[];
  programs: Item[];
  programVersions: Item[];
  courses: Item[];
  courseVersions: Item[];
  offerings: Item[];
  branches: Item[];
};

type Notice = {
  type: "success" | "error";
  text: string;
};

const emptyCatalog: Catalog = {
  languages: [],
  levels: [],
  programs: [],
  programVersions: [],
  courses: [],
  courseVersions: [],
  offerings: [],
  branches: [],
};


const buttonClass =
  "rounded-md bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800 disabled:opacity-60";

type TableCell = string | number | null | undefined;

function FormCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-300 bg-white p-5">
      <h2 className="text-lg font-semibold">{title}</h2>

      <p className="mt-1 mb-4 text-sm text-slate-600">
        {description}
      </p>

      {children}
    </section>
  );
}

function TextField({
  label,
  value,
  onChange,
  required = false,
  maxLength,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  maxLength?: number;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-800">
        {label}
      </label>

      <input
        type={type}
        value={value}
        required={required}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-slate-400 bg-white px-3 py-2 text-slate-900"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  required = true,
  emptyLabel = "-- Chọn --",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  required?: boolean;
  emptyLabel?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-800">
        {label}
      </label>

      <select
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-slate-400 bg-white px-3 py-2 text-slate-900"
      >
        <option value="">{emptyLabel}</option>

        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function StatusSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <SelectField
      label="Trạng thái"
      value={value}
      onChange={onChange}
      options={[
        { value: "DRAFT", label: "Bản nháp" },
        { value: "ACTIVE", label: "Hoạt động" },
        { value: "ARCHIVED", label: "Lưu trữ" },
      ]}
    />
  );
}

function DataTable({
  title,
  headers,
  rows,
}: {
  title: string;
  headers: string[];
  rows: TableCell[][];
}) {
  return (
    <section className="rounded-lg border border-slate-300 bg-white p-5">
      <h2 className="mb-4 text-lg font-semibold">
        {title} ({rows.length})
      </h2>

      {rows.length === 0 ? (
        <p className="text-sm text-slate-600">
          Chưa có dữ liệu.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-300 bg-slate-100">
                {headers.map((header) => (
                  <th key={header} className="p-3">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {rows.map((row, index) => (
                <tr
                  key={index}
                  className="border-b border-slate-200 hover:bg-slate-50"
                >
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="p-3">
                      {cell === null ||
                      cell === undefined ||
                      cell === ""
                        ? "—"
                        : String(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function CatalogManager({
  canCreate,
}: {
  canCreate: boolean;
}) {
  const [data, setData] = useState<Catalog>(emptyCatalog);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);

  const [language, setLanguage] = useState({ code: "", name: "" });
  const [level, setLevel] = useState({
    code: "",
    name: "",
    description: "",
  });

  const [program, setProgram] = useState({
    languageId: "",
    code: "",
    name: "",
    description: "",
  });

  const [programVersion, setProgramVersion] = useState({
    programId: "",
    versionNo: "1.0",
    description: "",
    status: "DRAFT",
  });

  const [course, setCourse] = useState({
    programVersionId: "",
    levelId: "",
    code: "",
    name: "",
    description: "",
  });

  const [courseVersion, setCourseVersion] = useState({
    courseId: "",
    versionNo: "1.0",
    description: "",
    tuitionFee: "",
    status: "DRAFT",
  });

  const [offering, setOffering] = useState({
    branchId: "",
    courseVersionId: "",
    code: "",
    startDate: "",
    endDate: "",
    maxStudents: "20",
    status: "ACTIVE",
  });

  const loadData = useCallback(async () => {
    setLoading(true);

    try {
      const response = await fetch("/api/catalog", {
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Không thể tải danh mục.");
      }

      setData(result);

      setProgram((old) => ({
        ...old,
        languageId: old.languageId || result.languages[0]?.id || "",
      }));

      setProgramVersion((old) => ({
        ...old,
        programId: old.programId || result.programs[0]?.id || "",
      }));

      setCourse((old) => ({
        ...old,
        programVersionId:
          old.programVersionId ||
          result.programVersions[0]?.id ||
          "",
        levelId: old.levelId || "",
      }));

      setCourseVersion((old) => ({
        ...old,
        courseId: old.courseId || result.courses[0]?.id || "",
      }));

      setOffering((old) => ({
        ...old,
        branchId: old.branchId || result.branches[0]?.id || "",
        courseVersionId:
          old.courseVersionId ||
          result.courseVersions[0]?.id ||
          "",
      }));
    } catch (error) {
      setNotice({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Không thể tải danh mục.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      await loadData();
    };
    
    fetchData();
  }, [loadData]);

  async function create(
    event: FormEvent<HTMLFormElement>,
    entity: string,
    payload: Record<string, unknown>,
    reset: () => void,
  ) {
    event.preventDefault();
    setSaving(entity);
    setNotice(null);

    try {
      const response = await fetch("/api/catalog", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ entity, ...payload }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Không thể tạo dữ liệu.");
      }

      reset();

      setNotice({
        type: "success",
        text: result.message || "Tạo dữ liệu thành công.",
      });

      await loadData();
    } catch (error) {
      setNotice({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Không thể tạo dữ liệu.",
      });
    } finally {
      setSaving("");
    }
  }

  // function FormCard({
  //   title,
  //   description,
  //   children,
  // }: {
  //   title: string;
  //   description: string;
  //   children: ReactNode;
  // }) {
  //   return (
  //     <section className="rounded-lg border border-slate-300 bg-white p-5">
  //       <h2 className="text-lg font-semibold">{title}</h2>
  //       <p className="mt-1 mb-4 text-sm text-slate-600">
  //         {description}
  //       </p>
  //       {children}
  //     </section>
  //   );
  // }

  // function TextField({
  //   label,
  //   value,
  //   onChange,
  //   required = false,
  //   maxLength,
  //   placeholder,
  //   type = "text",
  // }: {
  //   label: string;
  //   value: string;
  //   onChange: (value: string) => void;
  //   required?: boolean;
  //   maxLength?: number;
  //   placeholder?: string;
  //   type?: string;
  // }) {
  //   return (
  //     <div>
  //       <label className={labelClass}>{label}</label>
  //       <input
  //         type={type}
  //         value={value}
  //         required={required}
  //         maxLength={maxLength}
  //         placeholder={placeholder}
  //         onChange={(event) => onChange(event.target.value)}
  //         className={inputClass}
  //       />
  //     </div>
  //   );
  // }

  // function SelectField({
  //   label,
  //   value,
  //   onChange,
  //   options,
  //   required = true,
  //   emptyLabel = "-- Chọn --",
  // }: {
  //   label: string;
  //   value: string;
  //   onChange: (value: string) => void;
  //   options: { value: string; label: string }[];
  //   required?: boolean;
  //   emptyLabel?: string;
  // }) {
  //   return (
  //     <div>
  //       <label className={labelClass}>{label}</label>
  //       <select
  //         value={value}
  //         required={required}
  //         onChange={(event) => onChange(event.target.value)}
  //         className={inputClass}
  //       >
  //         <option value="">{emptyLabel}</option>
  //         {options.map((option) => (
  //           <option key={option.value} value={option.value}>
  //             {option.label}
  //           </option>
  //         ))}
  //       </select>
  //     </div>
  //   );
  // }

  // function StatusSelect({
  //   value,
  //   onChange,
  // }: {
  //   value: string;
  //   onChange: (value: string) => void;
  // }) {
  //   return (
  //     <SelectField
  //       label="Trạng thái"
  //       value={value}
  //       onChange={onChange}
  //       options={statusOptions.map(([value, label]) => ({
  //         value,
  //         label,
  //       }))}
  //     />
  //   );
  // }

  // function DataTable({
  //   title,
  //   headers,
  //   rows,
  // }: {
  //   title: string;
  //   headers: string[];
  //   rows: (string | number | null | undefined)[][];
  // }) {
  //   return (
  //     <section className="rounded-lg border border-slate-300 bg-white p-5">
  //       <h2 className="mb-4 text-lg font-semibold">
  //         {title} ({rows.length})
  //       </h2>

  //       {rows.length === 0 ? (
  //         <p className="text-sm text-slate-600">
  //           Chưa có dữ liệu.
  //         </p>
  //       ) : (
  //         <div className="overflow-x-auto">
  //           <table className="w-full border-collapse text-left text-sm">
  //             <thead>
  //               <tr className="border-b border-slate-300 bg-slate-100">
  //                 {headers.map((header) => (
  //                   <th key={header} className="p-3">
  //                     {header}
  //                   </th>
  //                 ))}
  //               </tr>
  //             </thead>

  //             <tbody>
  //               {rows.map((row, index) => (
  //                 <tr
  //                   key={index}
  //                   className="border-b border-slate-200 hover:bg-slate-50"
  //                 >
  //                   {row.map((cell, cellIndex) => (
  //                     <td key={cellIndex} className="p-3">
  //                       {cell === null || cell === undefined || cell === ""
  //                         ? "—"
  //                         : String(cell)}
  //                     </td>
  //                   ))}
  //                 </tr>
  //               ))}
  //             </tbody>
  //           </table>
  //         </div>
  //       )}
  //     </section>
  //   );
  // }

  return (
    <div className="text-slate-900">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-300 bg-white p-5">
          <div>
            <h1 className="text-2xl font-bold">
              Danh mục đào tạo
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Ngôn ngữ, trình độ, chương trình và các phiên bản khóa học.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void loadData()}
              disabled={loading}
              className="rounded-md border border-slate-400 bg-white px-4 py-2 font-medium hover:bg-slate-100 disabled:opacity-60"
            >
              Làm mới
            </button>

            <Link
              href="/dashboard"
              className="rounded-md bg-slate-800 px-4 py-2 font-semibold text-white hover:bg-slate-900"
            >
              Dashboard
            </Link>
          </div>
        </header>

        {notice && (
          <div
            role="status"
            className={
              notice.type === "success"
                ? "rounded-md border border-green-300 bg-green-50 p-3 text-green-900"
                : "rounded-md border border-red-300 bg-red-50 p-3 text-red-900"
            }
          >
            {notice.text}
          </div>
        )}

        {loading && (
          <p className="text-sm text-slate-600">
            Đang tải danh mục...
          </p>
        )}
        {!canCreate && (
          <div className="rounded-md border border-blue-300 bg-blue-50 p-4 text-blue-950">
            <p className="font-semibold">Chế độ chỉ xem</p>
            <p className="mt-1 text-sm">
              Vai trò hiện tại có quyền xem danh mục nhưng không có quyền tạo
              dữ liệu. Hãy đăng nhập bằng tài khoản Academic hoặc Admin để
              thêm ngôn ngữ, trình độ, chương trình và khóa học.
            </p>
        </div>
        )}

        <div className="grid gap-5 xl:grid-cols-2">
          <FormCard
            title="1. Thêm ngôn ngữ"
            description="Ví dụ: EN — English, JA — Japanese."
          >
            <form
              className="grid gap-3 sm:grid-cols-2"
              onSubmit={(e) =>
                void create(e, "language", language, () =>
                  setLanguage({ code: "", name: "" }),
                )
              }
            >
              <TextField
                label="Mã ngôn ngữ *"
                value={language.code}
                onChange={(v) =>
                  setLanguage({ ...language, code: v.toUpperCase() })
                }
                maxLength={20}
                required
                placeholder="EN"
              />

              <TextField
                label="Tên ngôn ngữ *"
                value={language.name}
                onChange={(v) =>
                  setLanguage({ ...language, name: v })
                }
                maxLength={100}
                required
                placeholder="English"
              />

              <button
                disabled={saving === "language"}
                className={buttonClass}
              >
                {saving === "language" ? "Đang lưu..." : "Thêm ngôn ngữ"}
              </button>
            </form>
          </FormCard>

          <FormCard
            title="2. Thêm trình độ"
            description="Ví dụ: A1, A2, B1. Cột framework không được tự thêm."
          >
            <form
              className="grid gap-3 sm:grid-cols-2"
              onSubmit={(e) =>
                void create(e, "level", level, () =>
                  setLevel({ code: "", name: "", description: "" }),
                )
              }
            >
              <TextField
                label="Mã trình độ *"
                value={level.code}
                onChange={(v) =>
                  setLevel({ ...level, code: v.toUpperCase() })
                }
                required
                maxLength={30}
                placeholder="A1"
              />

              <TextField
                label="Tên trình độ *"
                value={level.name}
                onChange={(v) => setLevel({ ...level, name: v })}
                required
                maxLength={100}
                placeholder="Elementary"
              />

              <div className="sm:col-span-2">
                <TextField
                  label="Mô tả"
                  value={level.description}
                  onChange={(v) =>
                    setLevel({ ...level, description: v })
                  }
                  placeholder="Mô tả trình độ..."
                />
              </div>

              <button
                disabled={saving === "level"}
                className={buttonClass}
              >
                {saving === "level" ? "Đang lưu..." : "Thêm trình độ"}
              </button>
            </form>
          </FormCard>

          <FormCard
            title="3. Thêm chương trình"
            description="Một chương trình thuộc một ngôn ngữ."
          >
            <form
              className="grid gap-3"
              onSubmit={(e) =>
                void create(e, "program", program, () =>
                  setProgram({
                    languageId: data.languages[0]?.id ?? "",
                    code: "",
                    name: "",
                    description: "",
                  }),
                )
              }
            >
              <SelectField
                label="Ngôn ngữ *"
                value={program.languageId}
                onChange={(v) =>
                  setProgram({ ...program, languageId: v })
                }
                options={data.languages.map((x) => ({
                  value: x.id,
                  label: `${x.name} (${x.code})`,
                }))}
              />

              <TextField
                label="Mã chương trình *"
                value={program.code}
                onChange={(v) =>
                  setProgram({ ...program, code: v.toUpperCase() })
                }
                required
                maxLength={50}
                placeholder="ENG-GENERAL"
              />

              <TextField
                label="Tên chương trình *"
                value={program.name}
                onChange={(v) =>
                  setProgram({ ...program, name: v })
                }
                required
                maxLength={150}
                placeholder="English General"
              />

              <TextField
                label="Mô tả"
                value={program.description}
                onChange={(v) =>
                  setProgram({ ...program, description: v })
                }
              />

              <button
                disabled={
                  saving === "program" || data.languages.length === 0
                }
                className={buttonClass}
              >
                {saving === "program" ? "Đang lưu..." : "Thêm chương trình"}
              </button>
            </form>
          </FormCard>

          <FormCard
            title="4. Thêm phiên bản chương trình"
            description="Mỗi phiên bản gắn với một chương trình đã có."
          >
            <form
              className="grid gap-3"
              onSubmit={(e) =>
                void create(e, "programVersion", programVersion, () =>
                  setProgramVersion({
                    ...programVersion,
                    versionNo: "",
                    description: "",
                    status: "DRAFT",
                  }),
                )
              }
            >
              <SelectField
                label="Chương trình *"
                value={programVersion.programId}
                onChange={(v) =>
                  setProgramVersion({
                    ...programVersion,
                    programId: v,
                  })
                }
                options={data.programs.map((x) => ({
                  value: x.id,
                  label: `${x.name} (${x.code})`,
                }))}
              />

              <TextField
                label="Số phiên bản *"
                value={programVersion.versionNo}
                onChange={(v) =>
                  setProgramVersion({
                    ...programVersion,
                    versionNo: v,
                  })
                }
                required
                maxLength={30}
                placeholder="1.0"
              />

              <TextField
                label="Mô tả"
                value={programVersion.description}
                onChange={(v) =>
                  setProgramVersion({
                    ...programVersion,
                    description: v,
                  })
                }
              />

              <StatusSelect
                value={programVersion.status}
                onChange={(v) =>
                  setProgramVersion({
                    ...programVersion,
                    status: v,
                  })
                }
              />

              <button
                disabled={
                  saving === "programVersion" ||
                  data.programs.length === 0
                }
                className={buttonClass}
              >
                {saving === "programVersion"
                  ? "Đang lưu..."
                  : "Thêm phiên bản"}
              </button>
            </form>
          </FormCard>

          <FormCard
            title="5. Thêm khóa học"
            description="Khóa học thuộc phiên bản chương trình; trình độ có thể để trống."
          >
            <form
              className="grid gap-3"
              onSubmit={(e) =>
                void create(e, "course", course, () =>
                  setCourse({
                    ...course,
                    code: "",
                    name: "",
                    description: "",
                  }),
                )
              }
            >
              <SelectField
                label="Phiên bản chương trình *"
                value={course.programVersionId}
                onChange={(v) =>
                  setCourse({ ...course, programVersionId: v })
                }
                options={data.programVersions.map((x) => ({
                  value: x.id,
                  label: `${x.programName} - ${x.version_no}`,
                }))}
              />

              <SelectField
                label="Trình độ"
                value={course.levelId}
                required={false}
                emptyLabel="Không chỉ định"
                onChange={(v) =>
                  setCourse({ ...course, levelId: v })
                }
                options={data.levels.map((x) => ({
                  value: x.id,
                  label: `${x.name} (${x.code})`,
                }))}
              />

              <TextField
                label="Mã khóa học *"
                value={course.code}
                onChange={(v) =>
                  setCourse({ ...course, code: v.toUpperCase() })
                }
                required
                maxLength={50}
                placeholder="ENG-A1-01"
              />

              <TextField
                label="Tên khóa học *"
                value={course.name}
                onChange={(v) =>
                  setCourse({ ...course, name: v })
                }
                required
                maxLength={150}
                placeholder="English A1"
              />

              <TextField
                label="Mô tả"
                value={course.description}
                onChange={(v) =>
                  setCourse({ ...course, description: v })
                }
              />

              <button
                disabled={
                  saving === "course" ||
                  data.programVersions.length === 0
                }
                className={buttonClass}
              >
                {saving === "course" ? "Đang lưu..." : "Thêm khóa học"}
              </button>
            </form>
          </FormCard>

          <FormCard
            title="6. Thêm phiên bản khóa học"
            description="Lưu học phí theo phiên bản, không ghi đè học phí của phiên bản cũ."
          >
            <form
              className="grid gap-3"
              onSubmit={(e) =>
                void create(e, "courseVersion", courseVersion, () =>
                  setCourseVersion({
                    ...courseVersion,
                    versionNo: "",
                    description: "",
                    tuitionFee: "",
                    status: "DRAFT",
                  }),
                )
              }
            >
              <SelectField
                label="Khóa học *"
                value={courseVersion.courseId}
                onChange={(v) =>
                  setCourseVersion({
                    ...courseVersion,
                    courseId: v,
                  })
                }
                options={data.courses.map((x) => ({
                  value: x.id,
                  label: `${x.name} (${x.code})`,
                }))}
              />

              <TextField
                label="Số phiên bản *"
                value={courseVersion.versionNo}
                onChange={(v) =>
                  setCourseVersion({
                    ...courseVersion,
                    versionNo: v,
                  })
                }
                required
                maxLength={30}
                placeholder="1.0"
              />

              <TextField
                label="Học phí"
                value={courseVersion.tuitionFee}
                onChange={(v) =>
                  setCourseVersion({
                    ...courseVersion,
                    tuitionFee: v,
                  })
                }
                type="number"
                placeholder="3500000"
              />

              <TextField
                label="Mô tả"
                value={courseVersion.description}
                onChange={(v) =>
                  setCourseVersion({
                    ...courseVersion,
                    description: v,
                  })
                }
              />

              <StatusSelect
                value={courseVersion.status}
                onChange={(v) =>
                  setCourseVersion({
                    ...courseVersion,
                    status: v,
                  })
                }
              />

              <button
                disabled={
                  saving === "courseVersion" ||
                  data.courses.length === 0
                }
                className={buttonClass}
              >
                {saving === "courseVersion"
                  ? "Đang lưu..."
                  : "Thêm phiên bản khóa học"}
              </button>
            </form>
          </FormCard>

          <FormCard
            title="7. Tạo đợt mở khóa học"
            description="Gắn một phiên bản khóa học với chi nhánh và khoảng thời gian cụ thể."
          >
            <form
              className="grid gap-3"
              onSubmit={(e) =>
                void create(e, "offering", offering, () =>
                  setOffering({
                    ...offering,
                    code: "",
                    startDate: "",
                    endDate: "",
                    maxStudents: "20",
                    status: "ACTIVE",
                  }),
                )
              }
            >
              <SelectField
                label="Chi nhánh *"
                value={offering.branchId}
                onChange={(v) =>
                  setOffering({ ...offering, branchId: v })
                }
                options={data.branches.map((x) => ({
                  value: x.id,
                  label: `${x.name} (${x.code})`,
                }))}
              />

              <SelectField
                label="Phiên bản khóa học *"
                value={offering.courseVersionId}
                onChange={(v) =>
                  setOffering({
                    ...offering,
                    courseVersionId: v,
                  })
                }
                options={data.courseVersions.map((x) => ({
                  value: x.id,
                  label: `${x.courseName} - ${x.version_no}`,
                }))}
              />

              <TextField
                label="Mã đợt mở khóa *"
                value={offering.code}
                onChange={(v) =>
                  setOffering({ ...offering, code: v.toUpperCase() })
                }
                required
                maxLength={50}
                placeholder="ENG-A1-2027-01"
              />

              <TextField
                label="Ngày bắt đầu *"
                value={offering.startDate}
                onChange={(v) =>
                  setOffering({ ...offering, startDate: v })
                }
                type="date"
                required
              />

              <TextField
                label="Ngày kết thúc *"
                value={offering.endDate}
                onChange={(v) =>
                  setOffering({ ...offering, endDate: v })
                }
                type="date"
                required
              />

              <TextField
                label="Sĩ số tối đa"
                value={offering.maxStudents}
                onChange={(v) =>
                  setOffering({ ...offering, maxStudents: v })
                }
                type="number"
              />

              <StatusSelect
                value={offering.status}
                onChange={(v) =>
                  setOffering({ ...offering, status: v })
                }
              />

              <button
                disabled={
                  saving === "offering" ||
                  data.branches.length === 0 ||
                  data.courseVersions.length === 0
                }
                className={buttonClass}
              >
                {saving === "offering"
                  ? "Đang lưu..."
                  : "Tạo đợt mở khóa học"}
              </button>
            </form>
          </FormCard>
        </div>

        <DataTable
          title="Ngôn ngữ"
          headers={["Mã", "Tên"]}
          rows={data.languages.map((x) => [
            x.code,
            x.name,
          ])}
        />

        <DataTable
          title="Trình độ"
          headers={["Mã", "Tên", "Mô tả"]}
          rows={data.levels.map((x) => [
            x.code,
            x.name,
            x.description as string,
          ])}
        />

        <DataTable
          title="Chương trình"
          headers={["Mã", "Tên", "Ngôn ngữ"]}
          rows={data.programs.map((x) => [
            x.code,
            x.name,
            `${x.language_name} (${x.language_code})`,
          ])}
        />

        <DataTable
          title="Phiên bản chương trình"
          headers={["Chương trình", "Phiên bản", "Trạng thái"]}
          rows={data.programVersions.map((x) => [
            x.programName,
            x.version_no,
            x.status,
          ])}
        />

        <DataTable
          title="Khóa học"
          headers={["Mã", "Tên", "Chương trình", "Trình độ"]}
          rows={data.courses.map((x) => [
            x.code,
            x.name,
            x.programName,
            x.levelName as string,
          ])}
        />

        <DataTable
          title="Phiên bản khóa học"
          headers={["Khóa học", "Phiên bản", "Học phí", "Trạng thái"]}
          rows={data.courseVersions.map((x) => [
            x.courseName,
            x.version_no,
            x.tuitionFee
              ? Number(x.tuitionFee).toLocaleString("vi-VN")
              : "Chưa thiết lập",
            x.status,
          ])}
        />

        <DataTable
          title="Đợt mở khóa học"
          headers={[
            "Mã đợt",
            "Khóa học",
            "Chi nhánh",
            "Bắt đầu",
            "Kết thúc",
            "Sĩ số tối đa",
            "Trạng thái",
          ]}
          rows={data.offerings.map((x) => [
            x.code,
            `${x.courseName} - ${x.courseVersionNo}`,
            x.branchName,
            x.start_date,
            x.end_date,
            x.max_students as number,
            x.status,
          ])}
        />
      </div>
    </div>
  );
}