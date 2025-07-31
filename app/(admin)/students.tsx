// app/(tabs)/students.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { useEnhancedCrud } from '@/hooks/useEnhancedCrud';
import { studentsRepository, Student } from '@/lib/localDb/studentsRepository';
import { officesRepository, Office } from '@/lib/localDb/officesRepository';
import { levelsRepository, Level } from '@/lib/localDb/levelsRepository';
import EnhancedDataTable, { Column } from '@/components/EnhancedDataTable';
import { ThemedView } from '@/components/ThemedView';
import DatePickerInput from '@/components/DatePickerInput';

export default function StudentsScreen() {
  const crud = useEnhancedCrud({
    repository: studentsRepository,
    displayName: 'الطالب'
  });

  const [offices, setOffices] = useState<Office[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  
  // Form state
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentBirthDate, setNewStudentBirthDate] = useState('');
  const [newStudentPhone, setNewStudentPhone] = useState('');
  const [newStudentAddress, setNewStudentAddress] = useState('');
  const [newStudentOfficeId, setNewStudentOfficeId] = useState<number | null>(null);
  const [newStudentLevelId, setNewStudentLevelId] = useState<number | null>(null);

  const fetchOfficesAndLevels = async () => {
    try {
      const [officesData, levelsData] = await Promise.all([
        officesRepository.getAll(),
        levelsRepository.getAll()
      ]);
      setOffices(officesData);
      setLevels(levelsData);
    } catch (error: any) {
      console.error('Failed to fetch offices and levels:', error);
    }
  };

  useEffect(() => { fetchOfficesAndLevels(); }, []);

  const columns: Column<Student>[] = [
    {
      key: 'name',
      label: 'الاسم',
      sortable: true,
      searchable: true,
      minWidth: 150,
      align: 'right',
    },
    {
      key: 'birth_date',
      label: 'تاريخ الميلاد',
      sortable: true,
      searchable: true,
      minWidth: 130,
      render: (item) => <Text style={styles.studentDetail}>{item.birth_date || 'غير محدد'}</Text>,
      align: 'right',
    },
    {
      key: 'phone',
      label: 'الهاتف',
      searchable: true,
      minWidth: 120,
      render: (item) => <Text style={styles.studentDetail}>{item.phone || 'لا يوجد'}</Text>,
      align: 'right',
    },
    {
      key: 'address',
      label: 'العنوان',
      searchable: true,
      minWidth: 200,
      render: (item) => <Text style={styles.studentDetail}>{item.address || 'لا يوجد'}</Text>,
      align: 'right',
    },
    {
      key: 'office_name',
      label: 'المركز',
      sortable: true,
      searchable: true,
      minWidth: 100,
      render: (item) => <Text style={styles.studentDetail}>{item.office_name || 'غير محدد'}</Text>,
      align: 'right',
    },
    {
      key: 'level_name',
      label: 'المستوى',
      sortable: true,
      searchable: true,
      minWidth: 100,
      render: (item) => <Text style={styles.studentDetail}>{item.level_name || 'غير محدد'}</Text>,
      align: 'right',
    },
    {
      key: 'operation_type',
      label: 'الحالة',
      render: (item) => (
        <Text style={styles.studentDetail}>
          {item.operation_type ? (
            <Text style={{ color: 'orange', fontWeight: 'bold' }}>معلق ({item.operation_type})</Text>
          ) : (
            'متزامن'
          )}
        </Text>
      ),
      align: 'center',
      minWidth: 120,
    },
  ];

  const actions = [
    {
      label: 'تعديل',
      iconName: 'create-outline' as keyof typeof Ionicons.glyphMap,
      onPress: (student: Student) => {
        setEditingStudent(student);
        setNewStudentName(student.name);
        setNewStudentBirthDate(student.birth_date || '');
        setNewStudentPhone(student.phone || '');
        setNewStudentAddress(student.address || '');
        setNewStudentOfficeId(student.office_id);
        setNewStudentLevelId(student.level_id);
        setModalVisible(true);
      },
      style: { backgroundColor: '#eff6ff' },
      textStyle: { color: '#3b82f6', fontSize: 12, fontWeight: '600' },
    },
    {
      label: 'حذف',
      iconName: 'trash-outline' as keyof typeof Ionicons.glyphMap,
      onPress: (student: Student) => crud.deleteItem(student.id),
      style: { backgroundColor: '#fef2f2' },
      textStyle: { color: '#ef4444', fontSize: 12, fontWeight: '600' },
    },
  ];

  const resetForm = () => {
    setNewStudentName('');
    setNewStudentBirthDate('');
    setNewStudentPhone('');
    setNewStudentAddress('');
    setNewStudentOfficeId(null);
    setNewStudentLevelId(null);
    setEditingStudent(null);
  };

  const handleSubmit = async () => {
    try {
      const studentData: Partial<Student> = {
        name: newStudentName.trim(),
        birth_date: newStudentBirthDate || undefined,
        phone: newStudentPhone.trim() || undefined,
        address: newStudentAddress.trim() || undefined,
        office_id: newStudentOfficeId!,
        level_id: newStudentLevelId!,
      };

      if (editingStudent) {
        await crud.updateItem(editingStudent.id, studentData);
      } else {
        await crud.createItem(studentData);
      }

      setModalVisible(false);
      resetForm();
    } catch (error: any) {
      console.error('Submit error:', error);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <EnhancedDataTable
        data={crud.filteredItems}
        columns={columns}
        actions={actions}
        searchQuery={crud.searchQuery}
        onSearchChange={crud.setSearchQuery}
        syncStatus={crud.syncStatus}
        onSync={crud.sync}
        refreshing={crud.loading}
        onRefresh={crud.refresh}
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => setModalVisible(true)}
      >
        <Ionicons name="add-outline" size={24} color="white" />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setModalVisible(false);
          resetForm();
        }}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingStudent ? 'تعديل الطالب' : 'إضافة طالب جديد'}
            </Text>

            <ScrollView style={styles.formContainer}>
              <TextInput
                style={styles.input}
                placeholder="اسم الطالب *"
                value={newStudentName}
                onChangeText={setNewStudentName}
                autoFocus
              />

              <DatePickerInput
                value={newStudentBirthDate}
                onDateChange={setNewStudentBirthDate}
                placeholder="تاريخ الميلاد (اختياري)"
                style={styles.input}
              />

              <TextInput
                style={styles.input}
                placeholder="رقم الهاتف (اختياري)"
                value={newStudentPhone}
                onChangeText={setNewStudentPhone}
                keyboardType="phone-pad"
              />

              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="العنوان (اختياري)"
                value={newStudentAddress}
                onChangeText={setNewStudentAddress}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              <View style={styles.pickerContainer}>
                <Text style={styles.pickerLabel}>المركز *</Text>
                <View style={styles.pickerWrapper}>
                  <Picker
                    selectedValue={newStudentOfficeId}
                    onValueChange={setNewStudentOfficeId}
                    style={styles.picker}
                  >
                    <Picker.Item label="اختر المركز" value={null} />
                    {offices.map(office => (
                      <Picker.Item
                        key={office.id}
                        label={office.name}
                        value={office.supabase_id || office.id}
                      />
                    ))}
                  </Picker>
                </View>
              </View>

              <View style={styles.pickerContainer}>
                <Text style={styles.pickerLabel}>المستوى *</Text>
                <View style={styles.pickerWrapper}>
                  <Picker
                    selectedValue={newStudentLevelId}
                    onValueChange={setNewStudentLevelId}
                    style={styles.picker}
                  >
                    <Picker.Item label="اختر المستوى" value={null} />
                    {levels.map(level => (
                      <Picker.Item
                        key={level.id}
                        label={level.name}
                        value={level.supabase_id || level.id}
                      />
                    ))}
                  </Picker>
                </View>
              </View>
            </ScrollView>

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={() => {
                  setModalVisible(false);
                  resetForm();
                }}
              >
                <Text style={styles.cancelButtonText}>إلغاء</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.submitButton]}
                onPress={handleSubmit}
                disabled={!newStudentName.trim() || !newStudentOfficeId || !newStudentLevelId}
              >
                <Text style={styles.submitButtonText}>
                  {editingStudent ? 'تحديث' : 'إضافة'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  studentDetail: {
    fontSize: 13,
    color: '#475569',
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    width: '90%',
    maxHeight: '85%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#1f2937',
  },
  formContainer: {
    maxHeight: 400,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    fontSize: 16,
    textAlign: 'right',
  },
  textArea: {
    height: 80,
  },
  pickerContainer: {
    marginBottom: 15,
  },
  pickerLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    textAlign: 'right',
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  picker: {
    height: 50,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  button: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#f3f4f6',
  },
  submitButton: {
    backgroundColor: '#6366f1',
  },
  'submitButton:disabled': {
    backgroundColor: '#9ca3af',
  },
  cancelButtonText: {
    color: '#374151',
    fontWeight: '600',
  },
  submitButtonText: {
    color: 'white',
    fontWeight: '600',
  },
});