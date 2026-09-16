using System;
using System.Diagnostics;
using System.IO;

internal static class StlToBgsdGuiLauncher
{
    private static int Main()
    {
        string baseDir = AppDomain.CurrentDomain.BaseDirectory;
        string guiPath = Path.Combine(baseDir, "stl-to-bgsd-gui.html");

        if (!File.Exists(guiPath))
        {
            Console.Error.WriteLine("Nao encontrei a interface:");
            Console.Error.WriteLine(guiPath);
            Console.WriteLine();
            Console.WriteLine("Pressione Enter para fechar.");
            Console.ReadLine();
            return 1;
        }

        try
        {
            Process.Start(new ProcessStartInfo
            {
                FileName = guiPath,
                UseShellExecute = true,
            });
            return 0;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine("Nao foi possivel abrir a interface no navegador padrao.");
            Console.Error.WriteLine(ex.Message);
            Console.WriteLine();
            Console.WriteLine("Pressione Enter para fechar.");
            Console.ReadLine();
            return 1;
        }
    }
}
