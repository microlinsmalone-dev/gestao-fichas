Set WshShell = CreateObject("WScript.Shell")
cmd = "C:\Users\USURIO~2\AppData\Local\Python\pythoncore-3.14-64\pythonw.exe D:\Malone\Projetos\Sistemas_Microlins\SistemaFichas_Web\bridge\microlins_excel_service.py"
WshShell.Run cmd, 0, False
